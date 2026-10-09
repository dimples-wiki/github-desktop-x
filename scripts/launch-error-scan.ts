// Zero-tolerance launch error scan: launch the installed app in a CLEAN
// environment (no injected git env vars — as a real user would), open a
// git repository, walk through the tabs, and collect EVERY error signal:
//  - visible error/warning dialogs (snapshotted periodically + at the end)
//  - renderer console errors and uncaught exceptions
//  - main-process stderr (app-attributed lines only)
// Exit code 0 only when nothing fired.
const { _electron } = require('/Users/yoko/dimple-github-desktop/workspace/node_modules/playwright')
const fs = require('fs')

const APP = '/Applications/GitHub Desktop X.app/Contents/MacOS/GitHub Desktop X'
const REPO = process.argv[2] || '/Users/yoko/dimple-github-desktop/scripts/fixtures/demo-repo'
const OUT = process.argv[3] || '/Users/yoko/dimple-github-desktop/screenshots/launch-scan'
fs.mkdirSync(OUT, { recursive: true })

const findings = []

;(async () => {
  // Clean env: strip the git-injecting vars the test harness usually sets.
  const env = { ...process.env }
  delete env.GIT_CONFIG_GLOBAL
  delete env.GIT_CONFIG_SYSTEM
  delete env.GIT_LFS_SKIP_SMUDGE
  delete env.GIT_SSH_COMMAND
  delete env.XDG_CONFIG_HOME
  // SSH_AUTH_SOCK left as-is (real user condition).

  const app = await _electron.launch({
    executablePath: APP,
    args: [`--cli-open=${REPO}`],
    env,
    timeout: 60000,
  })
  const page = await app.firstWindow()

  const scanDialogs = async tag => {
    try {
      const hits = await page.evaluate(() => {
        const out = []
        // The host renders popups inside .popup-component; error dialogs
        // carry an .error or dialog title. Collect any visible popup text.
        for (const el of document.querySelectorAll('.popup-component, [role=dialog]')) {
          const r = el.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) continue
          const text = (el.textContent || '').replace(/\s+/g, ' ').trim()
          if (text.length > 0) out.push(text.slice(0, 300))
        }
        return out
      })
      for (const h of hits) {
        findings.push({ kind: 'dialog', tag, text: h })
      }
    } catch {
      /* page busy/closed */
    }
  }

  page.on('console', m => {
    if (m.type() === 'error') findings.push({ kind: 'console.error', tag: 'runtime', text: m.text().slice(0, 500) })
  })
  page.on('pageerror', e =>
    findings.push({ kind: 'pageerror', tag: 'runtime', text: String(e).slice(0, 500) })
  )
  app.process().stderr?.on('data', d => {
    const s = String(d)
    // Ignore chromium/devtools noise that every electron app emits.
    if (/Debugger ending|inspector|Fontconfig warning/.test(s)) return
    if (/[Ee]rror|[Ff]ailed|Exception|Traceback/.test(s)) {
      findings.push({ kind: 'stderr', tag: 'main', text: s.slice(0, 500) })
    }
  })

  await page.waitForFunction(
    () => (document.getElementById('desktop-app-container')?.innerHTML.length ?? 0) > 100,
    null,
    { timeout: 60000 }
  )

  // Walk the flow a user would: wait for the repo to load, then tabs.
  for (const [ms, tag] of [
    [4000, 'launch+repo-load'],
    [2000, 'settled'],
  ]) {
    await page.waitForTimeout(ms)
    await scanDialogs(tag)
  }

  // Tabs: Changes → History → Commits → Changes (tree on/off once)
  await page.click('#changes-tab').catch(e => findings.push({ kind: 'driver', text: 'changes-tab: ' + e.message.split('\n')[0] }))
  await page.waitForTimeout(1500)
  await scanDialogs('changes-tab')

  await page.click('#history-tab').catch(() => {})
  await page.waitForTimeout(1500)
  await scanDialogs('history-tab')

  await page.click('#extension-tab-commits-filter').catch(() => {})
  await page.waitForTimeout(1500)
  await scanDialogs('commits-tab')

  await page.click('#changes-tab').catch(() => {})
  await page.waitForTimeout(800)
  const sw = page.locator('.changes-view-switch-icon').first()
  if (await sw.isVisible().catch(() => false)) {
    await sw.click()
    await page.waitForTimeout(1200)
    await scanDialogs('tree-view')
    await sw.click()
    await page.waitForTimeout(600)
  }

  await page.screenshot({ path: `${OUT}/final-state.png` })
  await app.close()

  // Report
  if (findings.length === 0) {
    console.log('LAUNCH SCAN: CLEAN — no dialogs, console errors, or stderr errors')
    process.exit(0)
  }
  console.log(`LAUNCH SCAN: ${findings.length} finding(s)`)
  for (const f of findings) {
    console.log(`[${f.kind}/${f.tag}]`, f.text)
  }
  process.exit(1)
})().catch(e => {
  console.error('SCAN FAIL', e.message.split('\n')[0])
  process.exit(2)
})
