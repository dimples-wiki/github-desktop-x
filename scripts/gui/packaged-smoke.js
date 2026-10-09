/* 打包产物冒烟：直接启动 dist 下的 .app 二进制，验证 Commits 标签页可用 */
const path = require('path')
const fs = require('fs')
const driver = require('/Users/yoko/github-desktop-x/scripts/gui/driver.js')
const { _electron } = require(path.join(
  __dirname, '..', '..', 'workspace', 'node_modules', 'playwright'
))

const ROOT = path.join(__dirname, '..', '..')
const APP_BIN = path.join(
  ROOT,
  'workspace',
  'dist',
  'GitHub Desktop Dimple-darwin-arm64',
  'GitHub Desktop Dimple.app',
  'Contents',
  'MacOS',
  'GitHub Desktop Dimple'
)

;(async () => {
  if (!fs.existsSync(APP_BIN)) throw new Error('打包产物不存在: ' + APP_BIN)

  const userData = path.join(ROOT, '.runtime', 'packaged-user-data')
  fs.rmSync(userData, { recursive: true, force: true })
  fs.mkdirSync(userData, { recursive: true })

  const app = await _electron.launch({
    executablePath: APP_BIN,
    args: [
      `--user-data-dir=${userData}`,
      `--cli-open=${driver.DEFAULT_REPO}`,
    ],
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: path.join(ROOT, '.runtime', 'fake-home', '.gitconfig'),
      GIT_CONFIG_SYSTEM: path.join(ROOT, '.runtime', 'fake-home', '.gitconfig-system'),
      XDG_CONFIG_HOME: path.join(ROOT, '.runtime', 'fake-home', '.config'),
      SSH_AUTH_SOCK: '',
      GIT_SSH_COMMAND: 'false',
    },
    timeout: 60000,
  })
  const page = await app.firstWindow()
  await page.waitForFunction(
    () =>
      (document.getElementById('desktop-app-container')?.innerHTML.length ??
        0) > 100,
    null,
    { timeout: 60000 }
  )
  await driver.ensureFirstRunDone(page)

  await driver.openCommits(page)
  await page.waitForTimeout(800)
  console.log('[packaged] count =', await driver.getResultCountText(page))

  await driver.setMessageFilter(page, 'release')
  await page.waitForTimeout(600)
  console.log('[packaged] msg=release:', await driver.getResultCountText(page))
  console.log('[packaged] rows:', await driver.getVisibleCommitSummaries(page))

  await driver.screenshot(page, '14-packaged-app-smoke')
  await app.close()
  console.log('[packaged] smoke OK')
})().catch(e => {
  console.error('PACKAGED SMOKE FAIL:', e.message)
  process.exit(1)
})
