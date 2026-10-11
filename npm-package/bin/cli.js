#!/usr/bin/env node
/**
 * GitHub Desktop X installer / launcher.
 *
 *   npx @dimples-wiki/githubx            安装缺失则装最新版，然后启动应用
 *   npx @dimples-wiki/githubx --update   强制重新下载最新版覆盖安装并启动
 *
 * 下载走 Node https（不给文件打 quarantine 标记），解压用系统 ditto，
 * 因此全程不触发 Gatekeeper，也不需要任何签名。
 */
'use strict'

const { execFileSync, spawn } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const https = require('https')
const os = require('os')
const path = require('path')

const OWNER = 'dimples-wiki'
const REPO = 'github-desktop-x'
const APP_NAME = 'GitHub Desktop X'
const APP_PATH = `/Applications/${APP_NAME}.app`

const ARCH = process.arch // arm64
const PLAT = `${process.platform}-${ARCH}`
const CACHE_DIR = path.join(os.homedir(), '.cache', 'githubx')

const args = new Set(process.argv.slice(2))
const forceUpdate = args.has('--update')
const wantsHelp = args.has('--help') || args.has('-h')

function log(msg) {
  process.stdout.write(`${msg}\n`)
}

function die(msg) {
  process.stderr.write(`${msg}\n`)
  process.exit(1)
}

function run(cmd, cmdArgs) {
  execFileSync(cmd, cmdArgs, { stdio: 'inherit' })
}

function sh(cmd) {
  return execFileSync('/bin/zsh', ['-c', cmd], { encoding: 'utf8' }).trim()
}

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        return resolve(get(res.headers.location, headers))
      }
      resolve({ res, finalUrl: url })
    })
    req.on('error', reject)
  })
}

const APP_VERSION = require('../package.json').appVersion

async function latestVersion() {
  log('查询最新版本 ...')

  // 1) 主站重定向：github.com 可达性远好于 api.github.com，且无 API 限速
  try {
    const { finalUrl } = await get(
      `https://github.com/${OWNER}/${REPO}/releases/latest`,
      { 'User-Agent': 'githubx-installer' }
    )
    const m = /\/tag\/v([^/?#]+)/.exec(finalUrl || '')
    if (m) {
      log(`最新版本 ${m[1]}`)
      return m[1]
    }
  } catch {}

  // 2) API（含镜像回退）
  const api = `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`
  for (const source of candidates(api)) {
    try {
      const { res } = await get(source, { 'User-Agent': 'githubx-installer' })
      let body = ''
      for await (const chunk of res) body += chunk
      if (res.statusCode !== 200) continue
      const tag = JSON.parse(body).tag_name
      if (tag) {
        log(`最新版本 ${tag.replace(/^v/, '')}（API）`)
        return tag.replace(/^v/, '')
      }
    } catch {}
  }

  // 3) 兜底：本安装器发行时所对应的应用版本
  log(`无法查询最新版本，使用内置版本 ${APP_VERSION}`)
  return APP_VERSION
}

/** 断点续传下载（.part 保留进度，完整后原子改名）。 */
// 下载源列表：GitHub 直连优先，失败自动回退公共镜像。
// 可用环境变量 GHX_MIRRORS 覆盖（逗号分隔，{url} 为占位符）。
const MIRRORS = (process.env.GHX_MIRRORS ||
  'https://mirror.ghproxy.com/{url},https://gh-proxy.com/{url}')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

function candidates(url) {
  const list = [url]
  for (const m of MIRRORS) {
    if (m.includes('{url}')) list.push(m.replace('{url}', url))
  }
  return list
}

async function downloadOnce(url, dest) {
  return new Promise((resolve, reject) => {
    const part = `${dest}.part`
    const have = fs.existsSync(part) ? fs.statSync(part).size : 0
    const headers = { 'User-Agent': 'githubx-installer' }
    if (have > 0) headers.Range = `bytes=${have}-`

    const req = https.get(url, { headers }, res => {
      // 重定向跟随（GitHub Release → objects.githubusercontent.com）
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        return resolve(downloadOnce(res.headers.location, dest))
      }
      if (res.statusCode === 416) {
        // 断点已齐：下载完成
        req.destroy()
        fs.renameSync(part, dest)
        return resolve(dest)
      }
      if (res.statusCode !== 200 && res.statusCode !== 206) {
        res.resume()
        return reject(new Error(`HTTP ${res.statusCode} ${url}`))
      }

      const total = have + parseInt(res.headers['content-length'] || '0', 10)
      const out = fs.createWriteStream(part, { flags: have > 0 ? 'a' : 'w' })
      let done = have
      res.on('data', c => {
        done += c.length
        if (total > 0) {
          const pct = ((done / total) * 100).toFixed(1)
          process.stdout.write(`\r下载中 ${pct}% (${(done / 1048576).toFixed(0)}MB)`)
        }
      })
      res.pipe(out)
      out.on('finish', () => {
        process.stdout.write('\n')
        fs.renameSync(part, dest)
        fs.writeFileSync(`${dest}.etag`, res.headers.etag || res.headers['last-modified'] || '')
        resolve(dest)
      })
      out.on('error', reject)
    })
    req.on('error', reject)
  })
}

async function download(url, dest) {
  const sources = candidates(url)
  for (let i = 0; i < sources.length; i++) {
    try {
      log(i === 0 ? `下载（直连）...` : `直连失败，切换镜像源 ${i} ...`)
      return await downloadOnce(sources[i], dest)
    } catch (e) {
      log(`  源失败：${e.message}`)
      if (i === sources.length - 1) throw e
    }
  }
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}


function readEtag(cachedZip) {
  const etagFile = `${cachedZip}.etag`
  if (!fs.existsSync(etagFile)) return null
  return fs.readFileSync(etagFile, 'utf8') || null
}

/** HEAD 跟随重定向，取最终响应的 ETag。失败返回 null（调用方自行兜底）。 */
function headEtag(url) {
  return new Promise(resolve => {
    const req = https.request(url, { method: 'HEAD', headers: { 'User-Agent': 'githubx-installer' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        return resolve(headEtag(res.headers.location))
      }
      res.resume()
      resolve(res.headers.etag || res.headers['last-modified'] || null)
    })
    req.on('error', () => resolve(null))
    req.end()
  })
}

function installedAppVersion() {
  try {
    return execFileSync(
      '/usr/libexec/PlistBuddy',
      ['-c', 'Print :CFBundleShortVersionString', `${APP_PATH}/Contents/Info.plist`],
      { encoding: 'utf8' }
    ).trim()
  } catch {
    return null
  }
}

/** 比较 semver：a > b 返回 true（忽略 prerelease 细节的宽松比较）。 */
function versionGt(a, b) {
  if (!a || !b) return false
  const pa = a.split('-')[0].split('.').map(Number)
  const pb = b.split('-')[0].split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true
    if ((pa[i] || 0) < (pb[i] || 0)) return false
  }
  return false
}

async function fetchAsset(version) {
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  const name = `GitHub-Desktop-X-${version}-macOS-${ARCH}.zip`
  const url = `https://github.com/${OWNER}/${REPO}/releases/download/v${version}/${name}`
  const dest = path.join(CACHE_DIR, name)

  // 版本名即内容：同版本 zip 直接复用缓存（--update 只强制重装应用）
  if (fs.existsSync(dest)) {
    log(`使用已缓存的 ${name}`)
    return dest
  }

  log(`下载 ${name} ...`)
  await download(url, dest)
  return dest
}

function install(zipFile) {
  if (process.platform !== 'darwin') die('本安装器仅支持 macOS。')
  if (ARCH !== 'arm64') die('本发布包仅支持 Apple Silicon (arm64)。')

  log(`解压并安装到 ${APP_PATH} ...`)
  fs.rmSync(APP_PATH, { recursive: true, force: true })
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'githubx-'))
  run('/usr/bin/ditto', ['-x', '-k', zipFile, tmp])
  const staged = path.join(tmp, `${APP_NAME}.app`)
  if (!fs.existsSync(staged)) die('zip 内容异常：找不到应用')
  run('/bin/mv', [staged, '/Applications/'])
  fs.rmSync(tmp, { recursive: true, force: true })
}

function launch() {
  log(`启动 ${APP_NAME} ...`)
  spawn('/usr/bin/open', ['-a', APP_NAME], { stdio: 'ignore', detached: true }).unref()
}

async function main() {
  if (wantsHelp) {
    log(`Usage: npx @dimples-wiki/githubx [--update]\n\n  无参数   应用缺失时安装最新版，然后启动\n  --update 强制重新下载最新版覆盖安装`)
    return
  }
  if (process.platform !== 'darwin') die('本安装器仅支持 macOS。')

  const installed = fs.existsSync(APP_PATH)
  const latest = await latestVersion()
  const installedVer = installed ? installedAppVersion() : null

  let needInstall = !installed || versionGt(latest, installedVer)

  if (installed && !needInstall && !forceUpdate) {
    // 版本相同：HEAD 探测发布资产内容是否被原地更新（ETag 变化 → 重装）
    const cachedZip = path.join(CACHE_DIR, `GitHub-Desktop-X-${latest}-macOS-${ARCH}.zip`)
    if (fs.existsSync(cachedZip)) {
      const current = await headEtag(
        `https://github.com/${OWNER}/${REPO}/releases/download/v${latest}/GitHub-Desktop-X-${latest}-macOS-${ARCH}.zip`
      )
      const stored = readEtag(cachedZip)
      if (current && stored !== current) {
        log('发布内容已更新（同版本覆盖），自动升级 ...')
        needInstall = true
      }
    } else {
      // 无缓存基线：下载一次以建立 ETag 基线
      needInstall = true
    }
  }

  if (!needInstall) {
    log(`已是最新（v${installedVer}），直接启动`)
    launch()
    return
  }

  const version = latest
  const zipFile = await fetchAsset(version)
  install(zipFile)
  log(`v${version} 安装完成`)
  launch()
}

main().catch(e => die(`失败：${e.message}`))
