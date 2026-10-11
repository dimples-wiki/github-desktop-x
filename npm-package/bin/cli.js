#!/usr/bin/env node
/**
 * GitHub Desktop X 安装器 / 启动器。
 *
 *   npx @dimples/github            应用缺失或本安装器版本更新时安装，然后启动
 *   npx @dimples/github --update   从包内/缓存强制重新解压覆盖安装
 *
 * 设计：每个安装器版本对应 GitHub Release 上一份独立命名的压缩包
 * （GitHub-Desktop-X-<安装器版本>-macOS-arm64.zip），永不覆盖 ——
 * 因此缓存按版本名判定即可，无需任何网络探测（ETag/API）。
 */
'use strict'

const { execFileSync, spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const PKG = require('../package.json')
const OWNER = 'dimples-wiki'
const REPO = 'github-desktop-x'
const APP_NAME = 'GitHub Desktop X'
const APP_PATH = `/Applications/${APP_NAME}.app`
const INSTALLER_VERSION = PKG.version
const APP_RELEASE = PKG.appVersion // 应用版本（Release tag 的来源）
const ASSET_NAME = `GitHub-Desktop-X-${INSTALLER_VERSION}-macOS-${process.arch}.zip`
const ASSET_URL = `https://github.com/${OWNER}/${REPO}/releases/download/v${APP_RELEASE}/${ASSET_NAME}`
const CACHE_DIR = path.join(require('os').homedir(), '.cache', 'githubx')

const args = new Set(process.argv.slice(2))
const update = args.has('--update')

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

function downloadOnce(url, dest) {
  return new Promise((resolve, reject) => {
    const part = `${dest}.part`
    const have = fs.existsSync(part) ? fs.statSync(part).size : 0
    const headers = { 'User-Agent': 'githubx-installer' }
    if (have > 0) headers.Range = `bytes=${have}-`

    const req = require('https').get(url, { headers }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        return resolve(downloadOnce(res.headers.location, dest))
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
      log(i === 0 ? '下载（直连）...' : `直连失败，切换镜像源 ${i} ...`)
      return await downloadOnce(sources[i], dest)
    } catch (e) {
      log(`  源失败：${e.message}`)
      if (i === sources.length - 1) throw e
    }
  }
}

function install(zipFile) {
  if (process.platform !== 'darwin') die('本安装器仅支持 macOS。')
  if (process.arch !== 'arm64') die('本发布包仅支持 Apple Silicon (arm64)。')

  log(`解压并安装到 ${APP_PATH} ...`)
  fs.rmSync(APP_PATH, { recursive: true, force: true })
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'githubx-'))
  run('/usr/bin/ditto', ['-x', '-k', zipFile, tmp])
  const staged = path.join(tmp, `${APP_NAME}.app`)
  if (!fs.existsSync(staged)) die('安装包内容异常：找不到应用')
  run('/bin/mv', [staged, '/Applications/'])
  fs.rmSync(tmp, { recursive: true, force: true })
}

function launch() {
  log(`启动 ${APP_NAME} ...`)
  spawn('/usr/bin/open', ['-a', APP_NAME], { stdio: 'ignore', detached: true }).unref()
}

function cacheZipPath() {
  return path.join(CACHE_DIR, ASSET_NAME)
}

async function main() {
  if (args.has('--help') || args.has('-h')) {
    log(
      `Usage: npx @dimples/github [--update]\n\n` +
        `  无参数   应用缺失或安装器版本更新时安装，然后启动\n` +
        `  --update 跳过缓存判定，强制重新解压覆盖安装`
    )
    return
  }
  if (process.platform !== 'darwin') die('本安装器仅支持 macOS。')
  if (process.arch !== 'arm64') die('本发布包仅支持 Apple Silicon (arm64)。')

  fs.mkdirSync(CACHE_DIR, { recursive: true })
  const cacheZip = cacheZipPath()

  // 升级判定：本安装器版本对应的缓存 zip 不存在 = 新版本首次运行 → 安装
  const needInstall = !fs.existsSync(cacheZip)

  if (!needInstall && !update) {
    log(`GitHub Desktop X（安装器 v${INSTALLER_VERSION}，应用 v${APP_RELEASE}）已就绪，直接启动`)
    launch()
    return
  }

  if (!fs.existsSync(cacheZip)) {
    log(`获取 ${ASSET_NAME} ...`)
    await download(ASSET_URL, cacheZip)
  }

  install(cacheZip)
  log(`安装完成（应用 v${APP_RELEASE}）`)
  launch()
}

main()
