/* 诊断启动问题：打印窗口 URL、渲染进程 console/pageerror、主进程 stderr */
const path = require('path')
const fs = require('fs')
const { _electron } = require(path.join(
  __dirname, '..', '..', 'workspace', 'node_modules', 'playwright'
))

const ROOT = path.join(__dirname, '..', '..')
const RUNTIME = path.join(ROOT, '.runtime')

;(async () => {
  fs.mkdirSync(path.join(RUNTIME, 'user-data'), { recursive: true })
  fs.mkdirSync(path.join(RUNTIME, 'fake-home'), { recursive: true })

  const app = await _electron.launch({
    args: [
      path.join(ROOT, 'workspace', 'out', 'main.js'),
      `--user-data-dir=${path.join(RUNTIME, 'user-data')}`,
      `--cli-open=${path.join(ROOT, 'scripts', 'fixtures', 'demo-repo')}`,
    ],
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: path.join(RUNTIME, 'fake-home', '.gitconfig'),
      GIT_CONFIG_SYSTEM: path.join(RUNTIME, 'fake-home', '.gitconfig-system'),
      XDG_CONFIG_HOME: path.join(RUNTIME, 'fake-home', '.config'),
      SSH_AUTH_SOCK: '',
      GIT_SSH_COMMAND: 'false',
      ELECTRON_ENABLE_LOGGING: '1',
    },
    timeout: 30000,
  })

  const proc = app.process()
  proc.stdout?.on('data', d => process.stdout.write('[main-stdout] ' + d))
  proc.stderr?.on('data', d => process.stdout.write('[main-stderr] ' + d))

  app.on('window', async w => {
    console.log('[window]', await w.title(), await w.url())
    w.on('console', m => console.log('[console:' + m.type() + ']', m.text().slice(0, 300)))
    w.on('pageerror', e => console.log('[pageerror]', (e.stack || e.message).slice(0, 600)))
    w.on('crashed', () => console.log('[window-crashed]'))
    w.on('domcontentloaded', () => console.log('[domcontentloaded]'))
  })

  app.on('close', (code, signal) => console.log('[app-close]', code, signal))

  setTimeout(async () => {
    const windows = app.windows()
    console.log('window count:', windows.length)
    for (const w of windows) {
      console.log('- window url:', await Promise.resolve(w.url()).catch(e => String(e)))
      const html = await w
        .evaluate(() => document.body?.innerHTML?.slice(0, 300))
        .catch(e => 'eval-fail: ' + e.message.slice(0, 120))
      console.log('- body html:', html)
    }
    await app.close().catch(() => {})
    process.exit(0)
  }, 20000)
})().catch(e => {
  console.error('LAUNCH FAIL:', e)
  process.exit(1)
})
