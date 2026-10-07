# VERIFICATION 验收记录

> 验收方式：三个独立子 agent 盲测（互不共享实现上下文），维度与标准见 PLAN.md 第 4 节。
> 时间：2026-10-08；被测版本：upstream release-3.6.6 + 5 胶水补丁 + feature/commits-filter。

## 结果总览

| 维度 | 首轮 | 修复 | 复审 |
|------|------|------|------|
| A 功能完整可用（盲测 agent，A1–A10，70 检查项） | ✅ 全部通过 | — | — |
| B 高内聚低耦合可拓展（架构评审 agent，B1–B5） | ✅ 全部通过 | 评审建议已全部落实（见下） | ✅ |
| C UI 一致性（视觉评审 agent，C1–C5） | ❌ C2/C3/C4 不通过 | 3 项修复 + 2 项误报澄清 | ✅ Round-2 过 3/4，Round-3 全过（像素级） |

## A 功能盲测（首轮即全过）

独立 agent 仅凭 driver.js 工具与 git log 真值完成，未读任何实现代码。70/70 检查项通过，关键证据：

- A1 tab 枚举/切换：commits-tab 紧邻 history-tab，往返切换正确
- A2 数据一致性：Commits 与 History 各 34 条，集合与顺序逐一相等
- A3 作者：下拉 = All Authors + 4 人；每位作者计数与集合 = git log --author（Yoko 9 / Alex 8 / David 9 / Maria 8）
- A4 message：大小写不敏感；多词 AND 与词序无关（'release v1' ≡ 'v1 release'）；部分命中不误报
- A5 描述：只匹配正文（parser→恰 1 条 Release v1.0.0；readme 仅命中正文含词的 2 条而非标题 8 条）
- A6 时间：闭区间/单边/边界日（最新/最旧提交当日恰 1 条）全对；非法输入不崩溃
- A7 组合（三种）与 Clear Filters 一键还原正确
- A8 筛选结果点击 → 详情/文件列表/diff 正确（与 git diff-tree 一致）
- A9 滚动到底稳定无错
- A10 回归：Changes 空态、History 详情正常
- 截图：screenshots/bf-*.png（15 张，由盲测 agent 独立采集）

## B 架构评审（首轮即全过，建议已落实）

- 实测：assemble 连跑两次产物一致；9 个胶水文件、HEAD 纯净（grep=0）；5 补丁 reverse-apply 全过；单测 18/18
- 胶水量：9 文件 +93/−3（净 +90 行），全部注册/接线性质，业务逻辑 0 行进入胶水
- 扩展点：新增「提交元数据」维度只需改 feature/ 内 4 个文件（编译器驱动：ICommitFilter 字段→EmptyCommitFilter→filterCommits→控件→测试）
- 升级步骤已固化（见 risposte upgrade_steps），最大冲突面 = repository.tsx 三处三元，全部限制在胶水层

### 评审建议落实情况（全部完成）

1. ✅ PROGRESS「squash 菜单保留」失实 → **已为 CommitsSidebar 接线 onSquash**（与 Compare 同构，右键菜单完全对齐），而非改文档迁就缺陷
2. ✅ 「选中项可留在筛选集外」「Commits 不恢复滚动位置」→ 已补录 PROGRESS 关键决策
3. ✅ PLAN「按文件路径过滤可纯 feature/ 扩展」过度承诺 → 已改为「元数据维度可；路径维度需数据层扩展」
4. ✅ PLAN 目录布局与实现漂移（ui/commits vs ui/history/commits-*）→ 已修正
5. ✅ export-patches.sh 行数统计正则漏计空加号行（87→96）→ 已修正口径

## C UI 一致性（首轮 3 项不通过 → 修复 + 误报澄清）

### 采纳并修复（3 项）

| 问题（评审员证据） | 修复 |
|---|---|
| 双重清除按钮：`type=search` 原生 × 与 `displayClearButton` 应用 × 叠加 | 移除 `type="search"`，只保留应用清除按钮（上游从不组合两者，见 _text-box.scss:28 对原生 × 的定制） |
| 非法日期零反馈 | 红框（`--error-color`，对齐 textboxish 焦点态的用法）+ 红色提示行 "Invalid Date — YYYY-MM-DD"（role=alert），见 09 截图 |
| 空态/头像等待不足导致截图失真 | 截图统一等待 1.5s（头像为异步渲染）；筛选截图等待 600ms |

### 澄清为误报（2 项，附源码证据）

| 评审员发现 | 澄清 |
|---|---|
| 详情描述「等宽字体 + 浅色条带」像第三方混入 | **原生即如此**：`styles/ui/history/_commit-summary.scss:150` `.commit-summary-description { font-family: var(--font-family-monospace); }`。评审基线 01 未含详情头部，故误判。Commits 详情直接复用 History 的 `renderContentForHistory()`，两者像素级相同 |
| 筛选输入边框 rgb(113,123,133) 亮于 Compare 搜索框 rgb(20,20,20) | 评审参照物是 **FancyTextBox**（特例，--base-border）；所有标准文本框走 `@include textboxish` → `--contrast-border`（mixins/_textboxish.scss:10，暗色主题下即评审测得的浅灰）。我们的控件与全局标准文本框（提交框、clone URL 等）一致，保持不改 |

### 复审（Round-2 / Round-3，同一评审员，像素级取证）

**Round-2**：C1/C2/C4 通过（双重 × 消失、非法日期 danger 红 rgb(215,58,73)+提示行、头像一致性确认为截图时序问题并消除、澄清 A/B 均被接受并撤销「第三方混入感」指控）；唯一保留 C3——空态仅为单行小灰字，不符原生 blankslate 层级。

**Round-2 追加修复（评审 C5 建议全部落实）**：
- 空态重构为原生 blankslate 层级：搜索图标 + 标题 + 副标题 + Clear Filters 行动入口
- 非法日期聚焦光晕改红色系（消除蓝红混杂）
- 提示行常驻占位（修正日期时列表零跳动）

**Round-3 最终结论：overall = pass**
- 09 红色光晕零蓝色分量；08/09/11 文本带逐行一致（零布局位移）
- **13-history-detail-with-description.png 与 07 的详情头部区域 0 像素差异**——Commits 复用 History 详情渲染由推断升级为截图级实证
- 11 空态度量：图标→标题→副标题→按钮，垂直节奏 12-14px、整块居中，完全符合原生 blankslate 模式
- 剩余 3 条观察均为非阻塞低优先级项（陈旧选中项保留查看、常驻占位约 24px 高度代价、标准 textbox 边框与 FancyTextBox 特例的差异），已记录于 PROGRESS 关键决策

## 真实证据清单（screenshots/）

| 文件 | 内容 |
|---|---|
| 01-history-baseline.png | 原生 History（视觉基线） |
| 02-commits-default.png | Commits 默认态（34 commits） |
| 03-filter-author.png | 按提交人 Yoko Tanaka（9 of 34） |
| 04-filter-author-and-message.png | 作者+message 组合（1 of 34） |
| 05-filter-message-fuzzy.png | 多词模糊 "pagination bug"（1 of 34） |
| 06-filter-description.png | 描述搜索 "parser"（1 of 34） |
| 07-description-hit-detail.png | 命中详情（Release v1.0.0 + VERSION diff） |
| 08-filter-date-range.png | 2026-08-01~2026-09-30（12 of 34） |
| 09-invalid-date-state.png | 非法日期红框+提示 |
| 10-filter-combined.png | Alex Chen + 2026-10 起（3 of 34） |
| 11-no-matches-empty-state.png | 空态（0 of 34） |
| 12-commit-detail.png | 默认态点开详情 |
| 13-history-detail-with-description.png | 对照证据：History 含正文详情（与 07 的 Commits 详情头部 0 像素差异） |
| bf-*.png（15 张） | 功能盲测 agent 独立采集 |

所有截图均为实机运行（Electron + playwright 驱动，构建产物 workspace/out）真实渲染，非 mock。


---

# 第四轮验收：插件框架重构 + 折叠筛选栏（2026-10-08）

架构从「业务专属胶水」升级为「插件框架先行」（framework/ + 自注册插件）后全量复验：

## R 功能盲测复验（独立 agent，10/10 全过）

- R1 tab 回归：`extension-tab-commits-filter` 动态生成于 History 右侧，切换正常
- R2 数据回归：34 条集合与顺序 = git log main
- R3/R4 折叠：默认态 description/author/dates 完全不在 DOM；展开全部出现（author 5 项）；收起从 DOM 消失
- R5 收起生效：author=Yoko → 收起 → 仍 9 of 34，按钮 selected 高亮
- R6 高级筛选 12/12：4 作者计数 8/9/8/9；message 大小写/多词 AND/词序无关；描述仅正文匹配；日期闭区间/单边边界日全对（真值逐条比对）
- R7 组合 + Clear 还原
- R8 View 菜单出现 "Show Commits" ⌘3，菜单触发切换成功
- R9 详情/富空态回归
- R10 Changes/History 回归

## D UI 盲审复验（独立 agent，pass）

- D1 折叠默认态与原生 filter-box-container 形态同构，信息密度优于平铺
- D2 展开衔接自然、详情面板逐像素未动
- D3 隐藏筛选高亮符合原生 selected 语言（+ 三重冗余：高亮/计数/清除按钮）
- D4 计数与 Clear Filters 两态位置稳定
- D5 建议已采纳：隐藏筛选生效时 toggle 图标改用**漏斗**（区分"可展开"与"有隐藏筛选"），已重采 16 号截图

## 框架层新增单测

- `extensions-registry-test.ts`（5 用例）：manifest 校验/注册顺序/重复注册拒绝/section 双向映射/内建 section 不映射 —— 共 23 单测全绿
