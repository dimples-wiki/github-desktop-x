/* 一次性诊断：启动后 dump UI 状态 + 截图 */
const driver = require('/Users/yoko/github-desktop-x/scripts/gui/driver.js')

;(async () => {
  const { app, page } = await driver.launch()
  await page.waitForTimeout(3000)

  const state = await page.evaluate(() => ({
    welcome: !!document.querySelector('#welcome'),
    repositoryView: !!document.querySelector('#repository'),
    tabs: [...document.querySelectorAll('.tab-bar-item')].map(e => e.id),
    hasHistoryTab: !!document.querySelector('#history-tab'),
    bodyClasses: document.body.className,
    containerChildren: document.getElementById('desktop-app-container')
      ?.children.length,
    visibleText: document.body.innerText.slice(0, 400),
  }))
  console.log(JSON.stringify(state, null, 2))

  await driver.screenshot(page, 'debug-state')
  await app.close()
})().catch(e => {
  console.error('FAIL:', e.message)
  process.exit(1)
})
