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
      resolve({ res })
    })
    req.on('error', reject)
  })
}

async function latestVersion() {
  log('查询最新版本 ...')
  const { res } = await get(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, {
    'User-Agent': 'githubx-installer',
  })
  let body = ''
  for await (const chunk of res) body += chunk
  if (res.statusCode !== 200) die(`查询版本失败：HTTP ${res.statusCode}`)
  const tag = JSON.parse(body).tag_name
  if (!tag) die('发布信息异常：没有 tag_name')
  return tag.replace(/^v/, '')
}

/** 断点续传下载（.part 保留进度，完整后原子改名）。 */
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const part = `${dest}.part`
    const have = fs.existsSync(part) ? fs.statSync(part).size : 0
    const headers = { 'User-Agent': 'githubx-installer' }
    if (have > 0) headers.Range = `bytes=${have}-`

    const req = https.get(url, { headers }, res => {
      // 重定向跟随（GitHub Release → objects.githubusercontent.com）
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        return resolve(download(res.headers.location, dest))
      }
      if (res.statusCode === 416) {
        // 已下载完整
        req.destroy()
        fs.renameSync(part, dest)
        return resolve(dest)
      }
      if (res.statusCode !== 200 && res.statusCode !== 206) {
        res.resume()
        return reject(new Error(`HTTP ${res.statusCode} ${url}`))
      }

      const total =
        have + parseInt(res.headers['content-length'] || '0', 10)
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
        resolve(dest)
      })
      out.on('error', reject)
    })
    req.on('error', reject)
  })
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
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

  if (installed && !forceUpdate) {
    log(`${APP_NAME} 已安装，直接启动（--update 可强制更新）`)
    launch()
    return
  }

  const version = await latestVersion()
  const zipFile = await fetchAsset(version)
  install(zipFile)
  log(`v${version} 安装完成`)
  launch()
}

main().catch(e => die(`失败：${e.message}`))
