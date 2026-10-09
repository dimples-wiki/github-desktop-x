// Pixel-level comparison: Commits filter bar vs the calibrated Changes
// filter row. The funnel button and the text field must match the native
// Changes geometry; the commits input is wider only because it has no
// List/Tree switch to its right.
const { _electron } = require('/Users/yoko/github-desktop-x/workspace/node_modules/playwright')

const APP = '/Applications/GitHub Desktop X.app/Contents/MacOS/GitHub Desktop X'
const OUT = '/Users/yoko/github-desktop-x/screenshots'

async function measureChanges(page) {
  return page.evaluate(() => {
    const side = document.querySelector('.changes-list-container')
    const pick = el => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return {
        x: +r.x.toFixed(2), y: +r.y.toFixed(2),
        w: +r.width.toFixed(2), h: +r.height.toFixed(2),
        pad: cs.padding, bg: cs.backgroundColor,
      }
    }
    return {
      container: pick(side.querySelector('.header.filter-field-row')),
      button: pick(side.querySelector('.filter-button')),
      input: pick(side.querySelector('.filter-list-filter-field input')),
    }
  })
}

async function measureCommits(page) {
  return page.evaluate(() => {
    const root = document.querySelector('#commits-view')
    const pick = el => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return {
        x: +r.x.toFixed(2), y: +r.y.toFixed(2),
        w: +r.width.toFixed(2), h: +r.height.toFixed(2),
        pad: cs.padding, bg: cs.backgroundColor,
      }
    }
    const svgs = root
      ? root.querySelectorAll('.filter-box-container .filter-button svg').length
      : 0
    return {
      container: pick(root.querySelector('.filter-box-container')),
      button: pick(root.querySelector('.filter-button')),
      input: pick(root.querySelector('.commits-filter-field input')),
      buttonSvgCount: svgs,
    }
  })
}

;(async () => {
  const app = await _electron.launch({
    executablePath: APP,
    args: ['--cli-open=/Users/yoko/github-desktop-x/scripts/fixtures/demo-repo'],
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: '/tmp/gh3/.gitconfig',
      GIT_CONFIG_SYSTEM: '/tmp/gh3/.gitconfig-system',
      XDG_CONFIG_HOME: '/tmp/gh3/.config',
      SSH_AUTH_SOCK: '',
      GIT_SSH_COMMAND: 'false',
      GIT_LFS_SKIP_SMUDGE: '1',
    },
    timeout: 60000,
  })
  const page = await app.firstWindow()
  await page.waitForFunction(
    () => (document.getElementById('desktop-app-container')?.innerHTML.length ?? 0) > 100,
    null,
    { timeout: 60000 }
  )
  await page.waitForTimeout(3000)
  const closeBtn = page.locator('button:has-text("Close")')
  if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await closeBtn.click()
    await page.waitForTimeout(500)
  }
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].setBounds({ width: 960, height: 660 })
  })
  await page.waitForTimeout(800)

  const changes = await measureChanges(page)
  await page.click('#extension-tab-commits-filter')
  await page.waitForTimeout(2000)
  const commits = await measureCommits(page)
  await page.screenshot({ path: `${OUT}/62-measure-commits.png` })

  console.log('CHANGES:', JSON.stringify(changes, null, 1))
  console.log('COMMITS:', JSON.stringify(commits, null, 1))

  // Parity expectations: the funnel button must match exactly; the input
  // must match in y/height; the commits container must carry the same
  // padding + background as the native header.
  const checks = []
  const eq = (name, a, b) =>
    checks.push({ name, a, b, ok: Math.abs(a - b) <= 0.5 })
  eq('button.x', changes.button.x, commits.button.x)
  eq('button.w', changes.button.w, commits.button.w)
  eq('button.h', changes.button.h, commits.button.h)
  eq('input.y-offset', changes.input.y - changes.container.y, commits.input.y - commits.container.y)
  eq('input.h', changes.input.h, commits.input.h)
  checks.push({
    name: 'container.pad', a: changes.container.pad, b: commits.container.pad,
    ok: changes.container.pad === commits.container.pad,
  })
  checks.push({
    name: 'caret svgs (funnel+triangle)', a: 2, b: commits.buttonSvgCount,
    ok: commits.buttonSvgCount === 2,
  })
  for (const c of checks) {
    console.log((c.ok ? 'PASS' : 'FAIL'), c.name, 'changes=', c.a, 'commits=', c.b)
  }
  console.log(checks.every(c => c.ok) ? 'COMMITS PARITY OK' : 'COMMITS PARITY FAIL')
  await app.close()
  process.exit(checks.every(c => c.ok) ? 0 : 1)
})().catch(e => {
  console.error('FAIL', e.message.split('\n')[0])
  process.exit(1)
})
