/**
 * 采集全套验收截图：History 基线 + Commits 各筛选维度 + 组合 + 详情 + 空态 + Changes List/Tree 双视图。
 * 产物落在 screenshots/ 下，编号与 docs/VERIFICATION.md 的证据清单对应。
 */
const driver = require('/Users/yoko/github-desktop-x/scripts/gui/driver.js')

async function waitListLoaded(page) {
  await page
    .waitForSelector('#commit-list .commit', { timeout: 15000 })
    .catch(() => {})
  // 头像等异步资源需要额外时间渲染，避免截图对比失真
  await page.waitForTimeout(1500)
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

  // 15 展开高级筛选后的完整筛选栏（无筛选）
  await driver.expandFilters(page)
  await page.waitForTimeout(300)
  await driver.screenshot(page, '15-expanded-filters')

  // 03 按提交人筛选：Yoko Tanaka
  await driver.setAuthorFilter(page, 'Yoko Tanaka')
  await page.waitForTimeout(600)
  console.log('[capture] author=Yoko:', await driver.getResultCountText(page))
  await driver.screenshot(page, '03-filter-author')

  // 16 收起高级筛选：隐藏中的筛选仍生效，toggle 按钮高亮提示
  await driver.collapseFilters(page)
  await page.waitForTimeout(300)
  console.log('[capture] collapsed w/ hidden filter:', await driver.getResultCountText(page))
  await driver.screenshot(page, '16-collapsed-hidden-active')

  // 04 作者 + message 模糊搜索组合："fix"
  await driver.setMessageFilter(page, 'fix')
  await page.waitForTimeout(600)
  console.log('[capture] +msg fix:', await driver.getResultCountText(page))
  await driver.screenshot(page, '04-filter-author-and-message')

  // 清空，回到全量
  await driver.clearFilters(page)
  await page.waitForTimeout(600)

  // 05 message 模糊搜索（多词 AND）："pagination bug"
  await driver.setMessageFilter(page, 'pagination bug')
  await page.waitForTimeout(600)
  console.log('[capture] msg "pagination bug":', await driver.getResultCountText(page))
  await driver.screenshot(page, '05-filter-message-fuzzy')
  await driver.clearFilters(page)

  // 06 描述（正文）搜索："parser"
  await driver.setDescriptionFilter(page, 'parser')
  await page.waitForTimeout(600)
  console.log('[capture] desc "parser":', await driver.getResultCountText(page))
  await driver.screenshot(page, '06-filter-description')
  await driver.collapseFilters(page)
  await page.waitForTimeout(300)

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
  await page.waitForTimeout(600)
  console.log('[capture] date range:', await driver.getResultCountText(page))
  await driver.screenshot(page, '08-filter-date-range')

  // 10 组合筛选：作者 Alex Chen + 时间 2026-10-01 起
  await driver.clearFilters(page)
  await driver.setAuthorFilter(page, 'Alex Chen')
  await driver.setDateRangeFilter(page, '2026-10-01', null)
  await page.waitForTimeout(600)
  console.log('[capture] Alex since Oct:', await driver.getResultCountText(page))
  await driver.screenshot(page, '10-filter-combined')
  await driver.clearFilters(page)
  await driver.collapseFilters(page)
  await page.waitForTimeout(300)

  // 11 无匹配空态
  await driver.setMessageFilter(page, 'zzz-no-such-commit')
  await page.waitForTimeout(600)
  console.log('[capture] empty state:', await driver.getResultCountText(page))
  await driver.screenshot(page, '11-no-matches-empty-state')
  await driver.clearFilters(page)

  // 12 点击一条提交查看详情（默认态下的原生体验）
  await waitListLoaded(page)
  await page.locator('#commit-list .commit').first().click()
  await page.waitForTimeout(1500)
  await driver.screenshot(page, '12-commit-detail')

  // 13 对照证据：History 中选中含描述(正文)的提交，详情头与 Commits 完全同构
  await driver.openHistory(page)
  await waitListLoaded(page)
  const target = page
    .locator('#commit-list .commit', { hasText: 'Release v1.0.0' })
    .first()
  await target.click()
  await page.waitForTimeout(1500)
  await driver.screenshot(page, '13-history-detail-with-description')

  // 14 Commits：漏斗 caret + 切 tab 后筛选保留
  await driver.openCommits(page)
  await waitListLoaded(page)
  const caretCount = await page
    .locator('#commits-view .filter-box-container .filter-button svg')
    .count()
  console.log('[capture] commits funnel svg count (expect 2) =', caretCount)
  await driver.setAuthorFilter(page, 'Yoko Tanaka')
  await page.waitForTimeout(600)
  const before = await driver.getResultCountText(page)
  await driver.collapseFilters(page)
  await driver.openChanges(page)
  await page.waitForTimeout(800)
  await driver.openCommits(page)
  await waitListLoaded(page)
  const after = await driver.getResultCountText(page)
  console.log(
    '[capture] commits filter persists across tabs:',
    before, '→', after, '=>', before === after
  )
  await driver.screenshot(page, '14-commits-filter-persists')
  await driver.clearFilters(page)

  // ── Changes/Tree 视图 ─────────────────────────────────────────
  await driver.openChanges(page)
  await page.waitForTimeout(1500)

  // 20 List 视图基线（原生，用于像素对比）
  await driver.screenshot(page, '20-changes-list-native')

  // 21 切到 Tree 视图：层级 + 复选框 + 状态徽标 + 原生筛选行
  await page.locator('.changes-view-switch-icon').first().click()
  await page.waitForTimeout(800)
  await driver.screenshot(page, '21-changes-tree-default')

  // 22 选中高亮 + diff 联动：点 demo.js
  const demoRow = page.locator('.changes-tree-row', { hasText: 'demo.js' })
  await demoRow.click()
  await page.waitForTimeout(1200)
  const selectedOk = await demoRow.evaluate(el =>
    el.classList.contains('selected')
  )
  console.log('[capture] tree leaf selected class =', selectedOk)
  await driver.screenshot(page, '22-changes-tree-selected')

  // 23 折叠文件夹：src 收起后 demo.js 消失
  await page.locator('.changes-tree-row.folder', { hasText: 'src' }).click()
  await page.waitForTimeout(500)
  const demoGone =
    (await page.locator('.changes-tree-row', { hasText: 'demo.js' }).count()) ===
    0
  console.log('[capture] collapsed hides demo.js =', demoGone)
  await driver.screenshot(page, '23-changes-tree-collapsed')
  await page.locator('.changes-tree-row.folder', { hasText: 'src' }).click()
  await page.waitForTimeout(500)

  // 24 文本筛选（tree 内 Filter 输入框）
  await page.fill('.changes-tree .filter-list-filter-field input', 'demo')
  await page.waitForTimeout(600)
  const filteredRows = await page.locator('.changes-tree-row').count()
  console.log('[capture] tree filter "demo" rows =', filteredRows)
  await driver.screenshot(page, '24-changes-tree-text-filter')

  // 24b 切 tab 后 tree 筛选保留（视图仍是 Tree、文本与行数不变）
  await driver.openHistory(page)
  await page.waitForTimeout(600)
  await driver.openChanges(page)
  await page.waitForTimeout(1000)
  const persistedText = await page
    .locator('.changes-tree .filter-list-filter-field input')
    .inputValue()
  const persistedRows = await page.locator('.changes-tree-row').count()
  console.log(
    '[capture] tree filter persists across tabs:',
    JSON.stringify(persistedText), persistedRows, 'rows =>',
    persistedText === 'demo' && persistedRows === filteredRows
  )
  await driver.screenshot(page, '24b-tree-filter-persists')
  await page.fill('.changes-tree .filter-list-filter-field input', '')
  await page.waitForTimeout(400)

  // 25 状态筛选弹层（原生 filter-popover 样式）
  await page.locator('.changes-tree .filter-button').first().click()
  await page.waitForTimeout(500)
  await driver.screenshot(page, '25-changes-tree-filter-popover')

  // 26 勾选 "New files"：应用筛选并自动收起（与原生 Changes 筛选一致）
  await page
    .locator('.filter-popover .filter-options label', {
      hasText: 'New files',
    })
    .click()
  await page.waitForTimeout(600)
  const readmeGone =
    (await page
      .locator('.changes-tree-row', { hasText: 'README2.md' })
      .count()) === 0
  console.log(
    '[capture] status filter New only hides README2.md =',
    readmeGone
  )
  await driver.screenshot(page, '26-changes-tree-status-filter')

  // 清除筛选：重开弹层 → Clear filters（同样自动收起）
  await page.locator('.changes-tree .filter-button').first().click()
  await page.waitForTimeout(400)
  await page.locator('.filter-popover .filter-options-footer button').click()
  await page.waitForTimeout(500)

  // 26 取消全选 → 行取消勾选；重新全选恢复
  const checkAll = page.locator('.changes-tree .changes-list-check-all input')
  await checkAll.click()
  await page.waitForTimeout(600)
  const anyIncluded = await page
    .locator('.changes-tree-row.changed-file-row.included, .changes-tree-row.included')
    .count()
  console.log('[capture] tree include-all off, included rows =', anyIncluded)
  await driver.screenshot(page, '27-changes-tree-include-all-off')
  await checkAll.click()
  await page.waitForTimeout(600)

  // 28 切回 List：同样的勾选/筛选状态语义，视图互换
  await page.locator('.changes-view-switch-icon').first().click()
  await page.waitForTimeout(800)
  await driver.screenshot(page, '28-changes-back-to-list')

  await app.close()
  console.log('[capture] done')
})().catch(e => {
  console.error('CAPTURE FAIL:', e)
  process.exit(1)
})
