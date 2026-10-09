// Records the launch experience: app opens → git repository loads → tabs
// walked. Video is saved alongside a machine-readable error report.
// Release gate: any visible error dialog, renderer console error, uncaught
// exception or app-attributed stderr error FAILS the run.
const { _electron } = require('/Users/yoko/github-desktop-x/workspace/node_modules/playwright')
const fs = require('fs')

const APP = '/Applications/GitHub Desktop X.app/Contents/MacOS/GitHub Desktop X'
const REPO = process.argv[2] || '/Users/yoko/github-desktop-x/scripts/fixtures/demo-repo'
const OUT = process.argv[3] || '/Users/yoko/github-desktop-x/screenshots/launch-recording'
fs.mkdirSync(OUT, { recursive: true })

const findings = []
const t0 = () => ((Date.now() - start) / 1000).toFixed(1) + 's'
let start = Date.now()

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
  const scanDialogs = async tag => {
    try {
      const hits = await page.evaluate(() => {
        const out = []
        for (const el of document.querySelectorAll('.popup-component, [role=dialog]')) {
          const r = el.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) continue
          const text = (el.textContent || '').replace(/\s+/g, ' ').trim()
          if (text.length > 0) out.push(text.slice(0, 300))
        }
        return out
      })
      for (const h of hits) findings.push({ kind: 'dialog', at: t0(), tag, text: h })
    } catch {}
  }

  page.on('console', m => {
    if (m.type() === 'error') findings.push({ kind: 'console.error', at: t0(), text: m.text().slice(0, 400) })
  })
  page.on('pageerror', e => findings.push({ kind: 'pageerror', at: t0(), text: String(e).slice(0, 400) }))
  app.process().stderr?.on('data', d => {
    const s = String(d)
    if (/Debugger ending|inspector|Fontconfig warning/.test(s)) return
    if (/[Ee]rror|[Ff]ailed|Exception|Traceback|Warning/.test(s)) {
      findings.push({ kind: 'stderr', at: t0(), text: s.slice(0, 400) })
    }
  })

  await page.waitForFunction(
    () => (document.getElementById('desktop-app-container')?.innerHTML.length ?? 0) > 100,
    null,
    { timeout: 60000 }
  )
  console.log('window rendered at', t0())

  // App opens straight into the repository (--cli-open). Give it time to
  // fully load, then walk the tabs like a user checking their project.
  await page.waitForTimeout(5000)
  await scanDialogs('repo-loaded')
  console.log('repository loaded at', t0())

  await page.click('#changes-tab')
  await page.waitForTimeout(1800)
  await scanDialogs('changes')
  await page.click('#history-tab')
  await page.waitForTimeout(1800)
  await scanDialogs('history')
  await page.click('#extension-tab-commits-filter')
  await page.waitForTimeout(1800)
  await scanDialogs('commits')
  await page.click('#changes-tab')
  await page.waitForTimeout(800)

  const sw = page.locator('.changes-view-switch-icon').first()
  if (await sw.isVisible().catch(() => false)) {
    await sw.click() // tree
    await page.waitForTimeout(1500)
    await scanDialogs('tree')
    await sw.click() // back to list
    await page.waitForTimeout(800)
  }
  await scanDialogs('final')

  await page.waitForTimeout(500) // let the video flush the last frames
  await app.close()

  const video = fs.readdirSync(OUT).filter(f => f.endsWith('.webm'))
  const report = { findings, video, verdict: findings.length === 0 ? 'PASS' : 'FAIL' }
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2))
  console.log('video:', video.join(', '))
  if (report.verdict === 'PASS') {
    console.log('RECORDING PASS — zero errors during launch → repo load → tabs')
  } else {
    console.log(`RECORDING FAIL — ${findings.length} finding(s):`)
    for (const f of findings) console.log(`[${f.kind}@${f.at}]`, f.text)
  }
  process.exit(report.verdict === 'PASS' ? 0 : 1)
})().catch(e => {
  console.error('RECORDING FAIL', e.message.split('\n')[0])
  process.exit(2)
})
