// Full-feature demo recording for remote acceptance: launch → repo load →
// Changes (List↔Tree, collapse, filter) → History → Commits (popover,
// author filter, cross-tab persistence). Window-content capture.
const { _electron } = require('/Users/yoko/github-desktop-x/workspace/node_modules/playwright')
const fs = require('fs')

const APP = '/Applications/GitHub Desktop X.app/Contents/MacOS/GitHub Desktop X'
const REPO = '/Users/yoko/github-desktop-x/scripts/fixtures/demo-repo'
const OUT = '/Users/yoko/github-desktop-x/dist-demo'
fs.mkdirSync(OUT, { recursive: true })

const findings = []

;(async () => {
  const env = { ...process.env }
  delete env.GIT_CONFIG_GLOBAL
  delete env.GIT_CONFIG_SYSTEM
  delete env.GIT_LFS_SKIP_SMUDGE
  delete env.GIT_SSH_COMMAND
  delete env.XDG_CONFIG_HOME

  const app = await _electron.launch({
    executablePath: APP,
    args: [`--cli-open=${REPO}`],
    env,
    timeout: 60000,
    recordVideo: { dir: OUT, size: { width: 1280, height: 800 } },
  })
  const page = await app.firstWindow()
  page.on('console', m => {
    if (m.type() === 'error') findings.push('console: ' + m.text().slice(0, 200))
  })
  page.on('pageerror', e => findings.push('pageerror: ' + String(e).slice(0, 200)))

  await page.waitForFunction(
    () => (document.getElementById('desktop-app-container')?.innerHTML.length ?? 0) > 100,
    null,
    { timeout: 60000 }
  )
  await page.waitForTimeout(4500) // repo loads

  // ── Changes: List → Tree（折叠/展开/文本筛选）→ List ──
  await page.click('#changes-tab')
  await page.waitForTimeout(1200)
  await page.locator('.changes-view-switch-icon').first().click()
  await page.waitForTimeout(1000)
  await page.locator('.changes-tree-row.folder', { hasText: 'src' }).click() // 折叠
  await page.waitForTimeout(700)
  await page.locator('.changes-tree-row.folder', { hasText: 'src' }).click() // 展开
  await page.waitForTimeout(700)
  await page.fill('.changes-tree .filter-list-filter-field input', 'demo')
  await page.waitForTimeout(900)
  await page.fill('.changes-tree .filter-list-filter-field input', '')
  await page.waitForTimeout(600)
  await page.locator('.changes-view-switch-icon').first().click() // 回 List
  await page.waitForTimeout(900)

  // ── History ──
  await page.click('#history-tab')
  await page.waitForTimeout(1500)

  // ── Commits：漏斗 caret + 弹层 + 作者筛选 + 切 tab 持久化 ──
  await page.click('#extension-tab-commits-filter')
  await page.waitForTimeout(1500)
  await page.locator('#commits-view .filter-box-container .filter-button').click()
  await page.waitForTimeout(800) // 弹层可见（漏斗+caret、高级筛选）
  await page.locator('.commits-filter-author select').selectOption({ label: 'Yoko Tanaka' })
  await page.waitForTimeout(600)
  await page.locator('#commits-view .filter-box-container .filter-button').click() // 收起
  await page.waitForTimeout(700)
  const persisted = await page.locator('.commits-filter-count').innerText()
  console.log('[demo] author filter count:', persisted)
  await page.click('#changes-tab')
  await page.waitForTimeout(900)
  await page.click('#extension-tab-commits-filter')
  await page.waitForTimeout(1400)
  const after = await page.locator('.commits-filter-count').innerText()
  console.log('[demo] after tab switch:', after, '→ persisted:', persisted === after)
  await page.locator('.filter-box-container .filter-button').click()
  await page.waitForTimeout(600)
  await page.locator('.filter-popover .filter-options-footer button').click()
  await page.waitForTimeout(600)

  await page.click('#changes-tab')
  await page.waitForTimeout(800)

  await page.waitForTimeout(400)
  await app.close()

  if (findings.length) {
    console.log('DEMO FINDINGS:', findings)
  } else {
    console.log('DEMO CLEAN — zero errors during full feature walk')
  }
})().catch(e => {
  console.error('DEMO FAIL', e.message.split('\n')[0])
  process.exit(1)
})
