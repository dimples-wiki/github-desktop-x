/**
 * 采集全套验收截图：History 对比基线 + Commits 各筛选维度 + 组合 + 详情 + 空态。
 * 产物落在 screenshots/ 下，编号与 docs/VERIFICATION.md 的证据清单对应。
 */
const driver = require('/Users/yoko/dimple-github-desktop/scripts/gui/driver.js')

async function waitListLoaded(page) {
  await page
    .waitForSelector('#commit-list .commit', { timeout: 15000 })
    .catch(() => {})
  await page.waitForTimeout(400)
}

;(async () => {
  const { app, page } = await driver.launch()
  console.log('[capture] launched')

  // 01 History 标签页（原生基线，用于 UI 一致性对比）
  await driver.openHistory(page)
  await waitListLoaded(page)
  console.log('[capture] history rows =', (await driver.getVisibleCommitSummaries(page)).length)
  await driver.screenshot(page, '01-history-baseline')

  // 02 Commits 标签页默认态（无筛选，应为全部 34 条）
  await driver.openCommits(page)
  await waitListLoaded(page)
  console.log('[capture] commits count =', await driver.getResultCountText(page))
  await driver.screenshot(page, '02-commits-default')

  // 03 按提交人筛选：Yoko Tanaka
  await driver.setAuthorFilter(page, 'Yoko Tanaka')
  await page.waitForTimeout(300)
  console.log('[capture] author=Yoko:', await driver.getResultCountText(page))
  await driver.screenshot(page, '03-filter-author')

  // 04 作者 + message 模糊搜索组合："fix"
  await driver.setMessageFilter(page, 'fix')
  await page.waitForTimeout(300)
  console.log('[capture] +msg fix:', await driver.getResultCountText(page))
  await driver.screenshot(page, '04-filter-author-and-message')

  // 清空，回到全量
  await driver.clearFilters(page)
  await page.waitForTimeout(300)

  // 05 message 模糊搜索（多词 AND）："pagination bug"
  await driver.setMessageFilter(page, 'pagination bug')
  await page.waitForTimeout(300)
  console.log('[capture] msg "pagination bug":', await driver.getResultCountText(page))
  await driver.screenshot(page, '05-filter-message-fuzzy')
  await driver.clearFilters(page)

  // 06 描述（正文）搜索："parser"
  await driver.setDescriptionFilter(page, 'parser')
  await page.waitForTimeout(300)
  console.log('[capture] desc "parser":', await driver.getResultCountText(page))
  await driver.screenshot(page, '06-filter-description')

  // 07 描述搜索命中后点开详情（右侧 diff 与 History 体验一致）
  const summaries = await driver.getVisibleCommitSummaries(page)
  if (summaries.length > 0) {
    await page.locator('#commit-list .commit').first().click()
    await page.waitForTimeout(1500)
    await driver.screenshot(page, '07-description-hit-detail')
  }
  await driver.clearFilters(page)

  // 08 时间范围筛选：2026-08-01 ~ 2026-09-30
  await driver.setDateRangeFilter(page, '2026-08-01', '2026-09-30')
  await page.waitForTimeout(400)
  console.log('[capture] date range:', await driver.getResultCountText(page))
  await driver.screenshot(page, '08-filter-date-range')

  // 09 非法日期输入（红色提示态）
  await driver.clearFilters(page)
  await driver.setDateRangeFilter(page, '2026-13-99', null)
  await page.waitForTimeout(300)
  await driver.screenshot(page, '09-invalid-date-state')
  await driver.clearFilters(page)

  // 10 组合筛选：作者 Alex Chen + 时间 2026-10-01 起
  await driver.setAuthorFilter(page, 'Alex Chen')
  await driver.setDateRangeFilter(page, '2026-10-01', null)
  await page.waitForTimeout(400)
  console.log('[capture] Alex since Oct:', await driver.getResultCountText(page))
  await driver.screenshot(page, '10-filter-combined')
  await driver.clearFilters(page)

  // 11 无匹配空态
  await driver.setMessageFilter(page, 'zzz-no-such-commit')
  await page.waitForTimeout(300)
  console.log('[capture] empty state:', await driver.getResultCountText(page))
  await driver.screenshot(page, '11-no-matches-empty-state')
  await driver.clearFilters(page)

  // 12 点击一条提交查看详情（默认态下的原生体验）
  await waitListLoaded(page)
  await page.locator('#commit-list .commit').first().click()
  await page.waitForTimeout(1500)
  await driver.screenshot(page, '12-commit-detail')

  await app.close()
  console.log('[capture] done')
})().catch(e => {
  console.error('CAPTURE FAIL:', e)
  process.exit(1)
})
