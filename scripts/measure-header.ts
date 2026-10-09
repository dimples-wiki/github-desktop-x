// Pixel-level DOM measurement: native List header vs plugin Tree header.
// Dumps bounding rects + computed styles for both modes to JSON.
const { _electron } = require('/Users/yoko/dimple-github-desktop/workspace/node_modules/playwright')

const APP = '/Applications/GitHub Desktop X.app/Contents/MacOS/GitHub Desktop X'
const OUT = '/Users/yoko/dimple-github-desktop/screenshots'

const RECT_PROPS = ['x', 'y', 'width', 'height', 'top', 'left', 'right', 'bottom']
const STYLE_PROPS = [
  'display', 'flex-direction', 'align-items', 'padding', 'margin',
  'border-bottom', 'border-radius', 'height', 'font-size', 'font-weight',
  'background-color', 'justify-content', 'flex', 'color', 'box-sizing',
]

async function measure(page, label) {
  return page.evaluate(
    ({ label, RECT_PROPS, STYLE_PROPS }) => {
      const pick = el => {
        if (!el) return null
        const r = el.getBoundingClientRect()
        const cs = getComputedStyle(el)
        const rect = {}
        for (const p of RECT_PROPS) rect[p] = Math.round(r[p] * 100) / 100
        const style = {}
        for (const p of STYLE_PROPS) style[p] = cs.getPropertyValue(p)
        return { rect, style, classes: el.className?.toString?.() ?? '' }
      }
      const q = sel => pick(document.querySelector(sel))

      const side = document.querySelector('.changes-list-container')?.closest('.panel')
        ?? document.querySelector('#changes-list-list')?.closest('.panel')
        ?? document.querySelector('.filter-box-container')?.closest('.panel')

      const sc = sel => (side ? pick(side.querySelector(sel)) : q(sel))
      function rowDetailOf(row: Element | null) {
        if (!row) return null
        const r = row.getBoundingClientRect()
        const parts: Record<string, any> = {}
        for (const [name, sel] of [
          ['checkbox', 'input[type=checkbox]'],
          ['label', '.path-text-component, .path-label-component, label, .text'],
          ['status', '.octicon, svg'],
        ] as const) {
          const el = row.querySelector(sel)
          if (el) {
            const b = el.getBoundingClientRect()
            parts[name] = {
              x: Math.round((b.x - r.x) * 100) / 100,
              y: Math.round((b.y - r.y) * 100) / 100,
              width: Math.round(b.width * 100) / 100,
              height: Math.round(b.height * 100) / 100,
              right: Math.round((b.right - r.x) * 100) / 100,
            }
          }
        }
        const cs = getComputedStyle(row)
        return {
          rect: {
            x: Math.round(r.x * 100) / 100,
            y: Math.round(r.y * 100) / 100,
            width: Math.round(r.width * 100) / 100,
            height: Math.round(r.height * 100) / 100,
          },
          parts,
          padding: cs.padding,
          classes: row.className?.toString?.() ?? '',
          text: row.textContent?.slice(0, 40),
        }
      }


      const rows = side
        ? [...side.querySelectorAll('.list-item')].filter(
            el => el.getBoundingClientRect().height > 0
          )
        : []

      // First FILE row (has an include checkbox) — the tree's first
      // .list-item is a folder row, which has no native counterpart.
      const firstLeaf =
        rows.find(el => el.querySelector('input[type=checkbox]')) ?? null
      const firstFolder =
        rows.find(
          el =>
            el.querySelector('.tree-caret') &&
            el.querySelector('input[type=checkbox]') === null
        ) ?? null

      return {
        headerRow: sc('.header.filter-field-row'),
        filterBox: sc('.filter-box-container'),
        buttonWrapper: sc('.filter-box-container > span'),
        filterButton: sc('.filter-button'),
        filterField: sc('.filter-list-filter-field'),
        filterInput: sc('.filter-list-filter-field input'),
        switchWrap: sc('.changes-view-switch-icons'),
        switchBtn: sc('.changes-view-switch-icon'),
        checkboxRow: sc('.checkbox-container'),
        checkAll: sc('.changes-list-check-all, .changes-tree-check-all'),
        checkAllInput: sc(
          '.changes-list-check-all input, .changes-tree-check-all input'
        ),
        checkAllLabel: sc(
          '.changes-list-check-all label, .changes-tree-check-all label'
        ),
        firstRow: rowDetailOf(firstLeaf),
        firstFolder: rowDetailOf(firstFolder),
        rowCount: rows.length,
      }
    },
    { label, RECT_PROPS, STYLE_PROPS }
  )
}

;(async () => {
  const app = await _electron.launch({
    executablePath: APP,
    args: ['--cli-open=/Users/yoko/dimple-github-desktop/scripts/fixtures/demo-repo'],
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

  // Match the capture-evidence window size so measurements reflect the
  // narrow-sidebar condition where flex overflow shows up.
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].setBounds({ width: 960, height: 660 })
  })
  await page.waitForTimeout(800)

  // ── List mode (native) ──
  const listData = await measure(page, 'list')
  await page.screenshot({ path: `${OUT}/60-measure-list-full.png` })

  // ── Tree mode (plugin) ──
  await page.evaluate(() => document.querySelector('.changes-view-switch-icon')?.click())
  await page.waitForTimeout(1500)
  const treeData = await measure(page, 'tree')
  await page.screenshot({ path: `${OUT}/61-measure-tree-full.png` })

  require('fs').writeFileSync(`${OUT}/measure-list.json`, JSON.stringify(listData, null, 2))
  require('fs').writeFileSync(`${OUT}/measure-tree.json`, JSON.stringify(treeData, null, 2))

  // Numeric diff summary
  const diffs = []
  for (const key of Object.keys(listData)) {
    const a = listData[key]
    const b = treeData[key]
    if (!a || !b) {
      diffs.push({ key, note: a ? 'missing in tree' : 'missing in list' })
      continue
    }
    for (const p of RECT_PROPS) {
      const d = Math.round(((b.rect?.[p] ?? 0) - (a.rect?.[p] ?? 0)) * 100) / 100
      if (Math.abs(d) > 0.5) diffs.push({ key, prop: p, list: a.rect[p], tree: b.rect[p], delta: d })
    }
  }
  console.log(JSON.stringify(diffs, null, 2))
  await app.close()
})().catch(e => {
  console.error('FAIL', e.message.split('\n')[0])
  process.exit(1)
})
