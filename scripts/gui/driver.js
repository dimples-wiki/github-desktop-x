/**
 * dimple-github-desktop GUI 驱动
 *
 * 用 workspace 自带的 playwright 驱动 Electron 应用（_electron.launch），
 * 复刻上游 app/test/e2e/e2e-fixtures.ts 的启动方式：
 *   - 入口: workspace/out/main.js（DESKTOP_SKIP_PACKAGE=1 的构建产物）
 *   - --cli-open 直接打开指定仓库
 *   - 首启自动通过 welcome 流程 / "移动到应用程序" 弹窗
 *
 * 用法（模块）:
 *   const driver = require('./driver')
 *   const { page } = await driver.launch()
 *   await driver.openCommits(page)
 *   await driver.setMessageFilter(page, 'fix')
 *   await driver.screenshot(page, 'filter-message')
 *
 * 用法（CLI 冒烟）:
 *   node scripts/gui/driver.js smoke
 */
const path = require('path')
const fs = require('fs')
const { _electron } = require(path.join(
  __dirname,
  '..',
  '..',
  'workspace',
  'node_modules',
  'playwright'
))

const ROOT = path.join(__dirname, '..', '..')
const RUNTIME = path.join(ROOT, '.runtime')
const USER_DATA = path.join(RUNTIME, 'user-data')
const FAKE_HOME = path.join(RUNTIME, 'fake-home')
const SCREENSHOTS = path.join(ROOT, 'screenshots')
const DEFAULT_REPO = path.join(ROOT, 'scripts', 'fixtures', 'demo-repo')

/** 启动应用（默认打开 demo-repo），完成首启流程后返回 { app, page } */
async function launch({ repo = DEFAULT_REPO, fresh = false } = {}) {
  if (fresh) {
    fs.rmSync(USER_DATA, { recursive: true, force: true })
  }
  fs.mkdirSync(USER_DATA, { recursive: true })
  fs.mkdirSync(FAKE_HOME, { recursive: true })
  fs.mkdirSync(SCREENSHOTS, { recursive: true })

  const entryPoint = path.join(ROOT, 'workspace', 'out', 'main.js')
  if (!fs.existsSync(entryPoint)) {
    throw new Error(`构建产物不存在: ${entryPoint}，请先执行构建`)
  }

  const app = await _electron.launch({
    args: [entryPoint, `--user-data-dir=${USER_DATA}`, `--cli-open=${repo}`],
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: path.join(FAKE_HOME, '.gitconfig'),
      GIT_CONFIG_SYSTEM: path.join(FAKE_HOME, '.gitconfig-system'),
      XDG_CONFIG_HOME: path.join(FAKE_HOME, '.config'),
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
  await ensureFirstRunDone(page)
  return { app, page }
}

/** 首次启动：跳过 welcome 流程、处理 macOS "移动到应用程序" 弹窗 */
async function ensureFirstRunDone(page) {
  const skipButton = page.locator('a.skip-button')
  if (await skipButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skipButton.click()

    const nameInput = page.locator('input[placeholder="Your Name"]')
    await nameInput.waitFor({ state: 'visible', timeout: 15000 })
    if ((await nameInput.inputValue()) === '') {
      await nameInput.fill('Yoko Tanaka')
    }

    const emailInput = page.locator(
      'input[placeholder="your-email@example.com"]'
    )
    if ((await emailInput.inputValue()) === '') {
      await emailInput.fill('yoko@example.com')
    }

    await page.locator('button:has-text("Finish")').click()
    await page.waitForSelector('#welcome', { state: 'hidden', timeout: 15000 })
  }

  await dismissMoveToApplicationsDialog(page)
}

async function dismissMoveToApplicationsDialog(page) {
  const btn = page.locator('button:has-text("Not Now"), button:has-text("Not now")')
  if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await btn.click()
    await btn.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {})
  }
}

// ── 标签页切换 ─────────────────────────────────────────────────────

async function openCommits(page) {
  await page.click('#commits-tab')
  await page.waitForSelector('#commits-view', { state: 'visible' })
}

async function openHistory(page) {
  await page.click('#history-tab')
}

async function openChanges(page) {
  await page.click('#changes-tab')
}

// ── 筛选操作（Commits 标签页） ─────────────────────────────────────

async function setAuthorFilter(page, authorName) {
  await page
    .locator('.commits-filter-author select')
    .selectOption({ label: authorName })
}

async function setMessageFilter(page, text) {
  await page.fill('input[aria-label="Filter by Message"]', text)
}

async function setDescriptionFilter(page, text) {
  await page.fill('input[aria-label="Filter by Description"]', text)
}

async function setDateRangeFilter(page, from, to) {
  if (from !== undefined && from !== null) {
    await page.fill('input[aria-label="From date"]', from)
  }
  if (to !== undefined && to !== null) {
    await page.fill('input[aria-label="To date"]', to)
  }
}

async function clearFilters(page) {
  await page.click('.commits-filter-clear-button')
}

// ── 读取状态 ───────────────────────────────────────────────────────

/** 筛选计数文案，如 "8 of 34 commits" */
async function getResultCountText(page) {
  return page.locator('.commits-filter-count').innerText()
}

/** 当前列表中可见的提交 summary 文本（按列表顺序） */
async function getVisibleCommitSummaries(page) {
  return page.$$eval('#commit-list .commit .summary', els =>
    els.map(el => el.textContent.trim())
  )
}

/** 选中提交的 SHA（列表选中态），无选中返回 null */
async function getSelectedCommitSha(page) {
  return page.evaluate(() => {
    const selected = document.querySelector('#commit-list .commit.selected')
    return selected ? selected.getAttribute('data-sha') ?? null : null
  })
}

/** Commits 筛选面板中当前可选的作者项 */
async function getAuthorOptions(page) {
  return page.$$eval('.commits-filter-author select option', els =>
    els.map(el => el.textContent.trim())
  )
}

/** 当前选中的标签页 id（changes-tab / history-tab / commits-tab） */
async function getSelectedTabId(page) {
  return page.evaluate(
    () =>
      document.querySelector('.tab-bar-item.selected')?.getAttribute('id') ??
      null
  )
}

// ── 截图 ───────────────────────────────────────────────────────────

async function screenshot(page, name) {
  fs.mkdirSync(SCREENSHOTS, { recursive: true })
  const file = path.join(SCREENSHOTS, `${name}.png`)
  await page.screenshot({ path: file })
  return file
}

module.exports = {
  launch,
  openCommits,
  openHistory,
  openChanges,
  setAuthorFilter,
  setMessageFilter,
  setDescriptionFilter,
  setDateRangeFilter,
  clearFilters,
  getResultCountText,
  getVisibleCommitSummaries,
  getSelectedCommitSha,
  getAuthorOptions,
  getSelectedTabId,
  screenshot,
  SCREENSHOTS,
  DEFAULT_REPO,
}

// ── CLI 冒烟 ───────────────────────────────────────────────────────

if (require.main === module) {
  const command = process.argv[2] ?? 'smoke'
  if (command !== 'smoke') {
    console.error('用法: node scripts/gui/driver.js [smoke]')
    process.exit(1)
  }

  ;(async () => {
    const { app, page } = await launch()
    console.log('[smoke] 应用已启动')

    await openHistory(page)
    console.log('[smoke] selected tab =', await getSelectedTabId(page))
    console.log('[smoke] history rows =', (await getVisibleCommitSummaries(page)).length)

    await openCommits(page)
    console.log('[smoke] selected tab =', await getSelectedTabId(page))
    console.log('[smoke] count =', await getResultCountText(page))
    console.log('[smoke] authors =', await getAuthorOptions(page))

    await setMessageFilter(page, 'fix')
    await page.waitForTimeout(300)
    console.log('[smoke] after message=fix:', await getResultCountText(page))
    console.log(
      '[smoke] summaries:',
      await getVisibleCommitSummaries(page)
    )
    await screenshot(page, 'smoke')

    await app.close()
    console.log('[smoke] done')
  })().catch(err => {
    console.error(err)
    process.exit(1)
  })
}
