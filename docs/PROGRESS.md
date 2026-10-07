# PROGRESS 进度记录

> 每完成一步即更新本文件（倒序追加）。约定：✅ 完成 / ⏳ 进行中 / ⬜ 未开始 / ⚠️ 有问题待解决

## 状态总览

| 阶段 | 状态 | 备注 |
|------|------|------|
| D0 环境与仓库骨架 | ✅ | Node 24.15.0 (/Users/yoko/.local/node，匹配上游 .nvmrc)、Yarn 1.22.22、父仓库 git init、submodule 锁 release-3.6.6 |
| D1 源码勘探 | ✅ | 结论见下「勘探记录」；标签页 = RepositorySectionTab 枚举成员，过滤器可完全客户端化，零改动 dispatcher/git-store/状态结构 |
| D2 workspace 组装 + 基线构建 | ✅ | scripts/assemble.sh；上游构建依赖 .git 元数据与 gemoji 等上游子模块，均已在脚本中处理 |
| D3 过滤纯逻辑 + 单测 | ✅ | commits-filter-logic.ts + 18 个单测全绿（yarn test:unit app/test/unit/commits-filter-logic-test.ts） |
| D4 UI 模块 + 胶水补丁 | ✅ | commits-sidebar.tsx + 5 个胶水补丁（净改动 87 行，全部为注册性加法） |
| D5 测试夹具 + GUI 驱动工具 | ✅ | scripts/make-fixture-repo.sh（34 提交/4 作者/含正文与分支）；scripts/gui/driver.js（playwright _electron） |
| D6 实机验证 + 截图 | ✅ | prod 构建产物 + playwright 驱动；12 张证据截图；筛选计数全部与夹具预期一致（34 总数 / Yoko 9 / 日期 12 / 组合 3 / 空态 0） |
| D7 盲测验收 + 升级演练 + 总结 | ✅ | A 70/70 全过；B 全过（5 条建议全落实）；C 三轮后全过（像素级）；升级演练成功 |

## 勘探记录（D1 结论，来自勘探 agent，实施时已核对）

- 标签系统：`app/src/ui/repository.tsx:151`（局部 Tab 枚举）、`:217 renderTabs`、`:717 onTabClicked`、`:387 renderSidebarContents`、`:634 renderContent`（均以 assertNever 收尾，扩展枚举即得编译器检查清单）；规范枚举 `RepositorySectionTab` 在 `app/src/lib/app-state.ts:469`；选中状态存于 IRepositoryState.selectedSection。
- 历史数据流：无独立 IHistoryState，历史在 `ICompareState`（app-state.ts:932）——`commitSHAs`（新→旧，分页向后追加）+ IRepositoryState.commitLookup（全部已加载提交）；批次加载 `dispatcher.loadNextCommitBatch`（app-store.ts:1957）；滚动触发 `compare.tsx:518 onScroll`（距底 10 行触发）。
- 列表组件：`CommitList`（history/commit-list.tsx:35）；CompareSidebar 在 componentWillMount 调 initializeCompare——我们的组件照做，保证直跳 Commits 也有数据。
- Commit 模型：models/commit.ts —— sha/shortSha/summary/body/author(CommitIdentity: name,email,date)/committer 等；列表展示 author.date（commit-list-item.tsx:130）→ 时间筛选按 author date。
- 可复用控件：TextBox（ariaLabel、displayInvalidState、displayClearButton、type=search）、Select、Button、Avatar、FilterList；无 i18n 框架，字符串直接书写。
- 样式：`styles/ui/_history.scss` 为索引，新增 `@import 'history/commits-filter';` 一行；筛选栏镜像 `.compare-form` 视觉规范（box-alt-background + spacing-half + base-border）。
- 测试：非 jest，node:test + tsx（script/test.mjs）；单文件 `yarn test:unit <file>`。
- e2e：playwright `_electron.launch`，入口 `out/main.js`（DESKTOP_SKIP_PACKAGE=1 产物），`--cli-open=<repo>` 启动即开仓库；welcome 流 `a.skip-button` → 姓名/邮箱 → Finish；macOS 弹窗点 "Not Now"。
- ⌘N 快捷键：build-default-menu.ts:183；id 需登记 menu-ids.ts、menu-event.ts、menu-update.ts（allMenuIds + repositoryScopedIDs）；处理在 app.tsx onMenuEvent。

## 关键决策

1. **Commits 与 History 共享同一份选择状态/数据**（commitSelection/commitLookup/compareState），右侧详情直接复用 `renderContentForHistory()`——「点开 diff 的体验原生一致」且零数据层改动。
2. **筛选为组件内纯客户端过滤**（commitSHAs → commits → filterCommits），不改数据流；分页沿用 loadNextCommitBatch。已知限制：筛选作用于「已加载」提交（与 History 渐进加载一致），扩展点见 PLAN。
3. **拖拽重排在 Commits 视图禁用**（reorderingEnabled=false）：过滤后列表索引 ≠ 真实历史顺序，重排有破坏性；cherry-pick/revert/reset/undo/amend/squash 等按选中提交操作的菜单全部保留（onSquash 已接线，与 Compare 同构）。
4. **选中项可留在筛选集之外**：详情区共享 History 的 commitSelection，当筛选条件变化使已选中提交不匹配时，详情保持显示该提交（与 History 跨分支切换时保留选中同哲学），列表与详情短暂"脱节"属预期行为。
5. **Commits 列表不持久化滚动位置**：History 通过 repository 状态恢复滚动；Commits 每次进入回到顶部（筛选场景下恢复滚动意义有限），如需持久化可扩展 onCompareListScrored 接线。
6. **边框与字体的原生依据**（应对 UI 盲审）：筛选控件使用上游标准 `textboxish` mixin（--contrast-border），与提交输入框等全局文本框一致；详情描述的等宽字体是上游原生样式（_commit-summary.scss:150）。
4. **时间筛选按 author date**（与列表显示一致），本地时区含边界；非法日期用上游 TextBox 的 displayInvalidState 呈现红色态且不参与过滤。

## 变更日志

- 2026-10-07 D0：环境检查（无 node/yarn）→ 用户目录安装 Node 24.15.0 + Yarn 1.22.22；创建父仓库；锁定上游 `release-3.6.6`；夹具仓库脚本。
- 2026-10-07 D1：勘探 agent 产出完整插入点报告（见上）。
- 2026-10-07 D2：assemble.sh 完成（git archive + 上游子模块同步 + 补丁重放 + overlay + 基线 git 仓库）。踩坑记录：①上游 build.ts 需要 workspace 内有 .git（注入版本元数据）；②gemoji/gitignore/choosealicense 是上游子模块，git archive 不包含；③yarn 装两层依赖（根 + app/），组装脚本需同时保留两处 node_modules。
- 2026-10-07 D3：commits-filter-logic.ts + 单测 18 个全绿（期间修复：筛选邮箱需双侧小写化）。
- 2026-10-07 D4：commits-sidebar.tsx（筛选栏 + 复用 CommitList）+ apply-glue.py（锚点校验式胶水注入）+ export-patches.sh → 5 补丁 87 行净改动；从零重放验证通过。
- 2026-10-07 D5：demo-repo 夹具（34 提交/4 作者/6-10 月/含多行正文/experiment 分支）；driver.js（playwright 驱动，welcome 流处理、筛选操作、截图 API）。
- 2026-10-08 D6：关键踩坑与解决：①dev 构建的 index.html 引用 localhost:3000（dev server），须用与上游 e2e 相同的 prod 构建（DESKTOP_SKIP_PACKAGE=1 DESKTOP_E2E_UPDATES_URL=… build:prod）；②playwright 复用 user-data 时残留扩展状态会让渲染进程 sandbox 崩溃，driver 每次清空 user-data；③--cli-open 对未添加仓库会弹出 Add Local Repository 确认框，driver 自动点击；④"移动到应用程序"弹窗用 addLocatorHandler 自动清除。12 张证据截图落盘 screenshots/，筛选计数与 git log 预期全部吻合。

- 2026-10-08 D7：三维盲测首轮：A 功能 70/70 全过（独立 agent 只用 driver+git log 真值）；B 架构 pass（胶水 9 文件 +93/−3，assemble 幂等实测，5 补丁 reverse-apply 全过，建议 5 条全部落实：onSquash 接线、文档勘误、统计口径修正）；C UI 首轮 3 项 fail → 修复（双重 ×、非法日期红框+提示、截图等待策略）+ 2 项误报澄清（等宽描述字体与 textboxish 边框均为上游原生样式，附 file:line 证据），已送同一评审员复审。
- 2026-10-08 D7：**submodule 升级演练成功**——upstream 切到 release-3.6.7-beta2 后 `./scripts/assemble.sh` 5 补丁零冲突重放（9 个胶水文件、commits-tab 生效）；随后回滚 release-3.6.6 并重建，父仓库指针无漂移。
- 2026-10-08 D7 完成：UI 盲审 Round-2（C1/C2/C4 过，剩空态一项）→ 空态重构为原生 blankslate 层级 + 红色聚焦光晕 + 提示行常驻占位 → Round-3 **overall = pass**（13 与 07 详情头部 0 像素差异实证详情渲染同构）。三维验收全部达成，最终交付。
