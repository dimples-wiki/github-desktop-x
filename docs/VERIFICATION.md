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


---

# 第五轮验收：运行时动态插件（2026-10-08）

架构升级为「上游只有扩展点入口 + 插件运行时动态加载」后的机制验证（功能逻辑与第四轮一致，未重写）：

## 双场景实证（GUI 自动化）

| 场景 | 结果 |
|------|------|
| 未安装插件 | tabs = [Changes, History]，Changes 页无树视图（0 行）——**扩展点零痕迹**（截图 19） |
| 安装两个插件 | tabs = [Changes, History, **Commits**]（动态注册，无需重启）；Commits 筛选可用（34 commits / fix→1）；Changes 文件列表被 **changes-tree** 插件替换为树形视图（src→plugins→demo.js 层级、状态色点、文件夹折叠+计数）；点击 README2.md → 宿主 diff 正确跟随（截图 20/21/22） |

## 机制组成

- 主进程 plugin-host：扫描 `<userData>/plugins`（DIMPLE_PLUGINS_DIR 可覆盖），读 plugin.json + renderer.js，seed 菜单清单 + 重建菜单
- 渲染进程 plugin-loader：IPC 就绪握手接收插件代码，在 `__GHD_EXTENSION_API__`（React/宿主组件/octicons/PopupType/注册函数/isDarwin）下 eval
- 响应式注册表：repository.tsx 订阅，插件装载即渲染 tab
- ChangesFileViewSlot：changes 列表的单点替换插槽（fallback=原生列表）

## 插件物料

- `plugins/commits-filter/`：plugin.json + src（ghd 桥/纯逻辑/组件/注册）+ 18 个单测（构建时运行）
- `plugins/changes-tree/`：plugin.json + src/index.tsx（树构建/折叠/状态色/选型联动）
- `scripts/build-plugins.sh`（esbuild→IIFE）、`scripts/install-plugins.sh`


---

# 第六轮：回归修复 + List/Tree 手动切换（2026-10-08）

针对「UI 一致性大退步」反馈的三项修复与实证：

## 修复清单

| 反馈 | 根因 | 修复 |
|------|------|------|
| commits 插件 UI 大退步（换行/贴字） | 动态插件的 CSS 没有随插件注入（`_commits-filter.scss` 留在宿主侧未 import） | 样式转为插件自有资产 `styles.ts`，注册时注入 `<style>`（同 changes-tree 模式）；布局实测 toggle+输入框同行（top 差 <2px） |
| Tree 抢占默认视图、无切换 | 注册即替换、无开关 | 宿主插槽内置 **List/Tree 分段开关**（宿主组件渲染、原生 selected 样式），**默认 List**；注册插件后原列表仍为默认 |
| 丢失 include 勾选/全选/数量 | 树形视图首版未实现 | 树视图补齐：tri-state **"N changed files" 全选头**（镜像原生 `.checkbox-container`）、**每文件 include 勾选**（联动宿主 commit 按钮 3→2 实证）、文件计数 |

## 实证（GUI 自动化全过）

1. tabs 三枚 ✓；2. 默认原生列表（含原生全选头）✓；3. List/Tree 开关 ✓；4. 树头部计数 ✓；5. 树 5 行 ✓；
6. 勾选联动 commit 按钮 3→2 ✓；7. 一键切回原生列表 ✓；8. commits 插件布局断言（同行/无 [object Object]/间距）✓。
截图：23-tree-with-checkboxes / 24-switch-back-to-list / 25-commits-style-regression-check。

## 本轮踩坑（动态插件开发范式总结）

- 插件 bundle 是 esbuild 产物：**顶层副作用必须真实存在**（只 export register() 无人调用会被摇树，犯了两次）；
- esbuild 会为跨模块同名 const 重命名（api→api2），**append 到源码尾部的裸标识符引用会脱钩** → 尽量从 api 解构而非裸全局；
- 插件 CSS 必须自带（宿主 SCSS 不覆盖动态插件）；
- 插件引用宿主组件必须走 `api.components.*`（顶层没有的符号是 undefined）。


---

# 第七轮：Commits 筛选栏复刻原生 changes 形态 + List/Tree 图标开关（2026-10-08）

针对「要原生 changes 页那种 filter 样式：点击输入框前的下拉按钮才出现更多筛选项；List/Tree 用图标切换且与搜索框同行」的改版验证（12 项断言全过）：

| # | 断言 | 结果 |
|---|------|------|
| 1 | tabs 三枚（动态插件） | ✓ |
| 2 | Changes 默认原生列表 | ✓ |
| 3 | **List/Tree 图标开关在 filter 搜索框行内**（List 选中） | ✓ |
| 4 | Tree 模式头部 "3 changed files" 计数 | ✓ |
| 5 | 树形 5 行（层级+勾选） | ✓ |
| 6 | Tree 模式开关仍可见且高亮 Tree | ✓ |
| 7 | 勾选联动 Commit 按钮 3→2 | ✓ |
| 8 | 切回原生列表 | ✓ |
| 9 | **Commits 筛选栏 = 原生连体形态**（filter 图标按钮 + 搜索框，间距 <2px） | ✓ |
| 10 | **点击图标弹出 Advanced Filters 气泡**（宿主 Popover，含描述/作者/日期 4 控件） | ✓ |
| 11 | 气泡内描述筛选 desc=parser → 1 of 34 | ✓ |
| 12 | 关闭按钮/点外关闭 | ✓ |

截图：27-commits-native-filter-popover（复刻形态）、28-commits-popover-filter-applied、23/24。

## 实现要点

- 筛选按钮/徽标/连体样式复用宿主 `.filter-box-container` + `.filter-button` + `.active-badge` 类（commits 插件 CSS 内复刻其规则——宿主作用域限定于 `#changes-list`，插件需自带等价 CSS）
- 高级筛选项使用宿主 **Popover 组件**（Balloon 装饰 + BottomRight 锚定 + 点外关闭，经 API 暴露给插件）
- List/Tree 图标开关（`listUnordered`/`fileDirectory` octicons）由框架 `ChangesFileViewSwitch` 渲染于宿主 filter 行与插件视图行（两种模式各自可见）

## 动态插件构建的三条铁律（本轮新增，详见 PROGRESS）

1. **入口文件含 JSX 必须用 `.tsx`**——esbuild 对 `.ts` 内 JSX 不转换（静默产出空实现）；
2. **namespace import（`import * as X`）若仅作 JSX 工厂/类型使用会被整体擦除**——统一用具名导入 `import { React } from './ghd'`；
3. 插件内不得引用宿主 webpack 全局（`__DARWIN__` 等），一律经 API（`isDarwin`）。


---

# 第八轮：Changes 截图补齐 + Commits 弹窗视觉打磨（2026-10-08）

针对「Changes 没看到截图」与「筛选弹窗边距大/无间距/关闭按钮丑」的修复：

## 修复

| 反馈 | 根因 | 修复 |
|------|------|------|
| 弹窗边距太大 | Popover 把子元素包在 `.popover-content`（基础内边距 `--spacing-double`） | 插件 CSS 覆盖为 `var(--spacing)`（与原生 changes filter-popover 相同的收紧） |
| 组件之间没有间距 | `.filter-options` 的 gap 样式随作用域缺失 | 插件 CSS 补 `.commits-filter-popover .filter-options { gap: var(--spacing) }` |
| 关闭按钮丑到爆 | 原生 close 按钮样式来自 `#changes-list` 作用域的 close-button mixin，弹窗拿到的是裸 `<button>` | 复刻 close-button mixin（16px、透明背景、secondary 色、hover 变主色） |

## 实证

- 弹窗指标实测：padding=10px、header→描述框间距 10px、关闭按钮 16px 透明背景
- 截图：32-commits-popover-polished（打磨后）、27（开合整体）、28（应用筛选）
- **Changes 页截图补齐**：30-changes-list-with-switch（默认 List + 搜索框行内图标开关）、23-tree-with-checkboxes（Tree + 勾选/全选/计数）、24-switch-back-to-list
- 12 项断言全过（同第七轮清单）

## 本轮踩坑

styles.ts 打磨弹窗 CSS 时整段替换把文件尾部的 `export function injectStyles()` 一并截掉 → styles.ts 变成零导出模块 → esbuild 警告 "Import will always be undefined" 并把调用擦成 `(void 0)()`（此前几轮的 "API 未声明/摇树" 部分现象同源）。**教训：改完插件文件必须确认 export 完整性，构建脚本对零导出模块要有告警。**


---

# 第九轮：用户反馈修复复验（2026-10-08）

针对用户指出的问题修复后，待独立盲测复验：

| # | 反馈 | 修复 |
|---|------|------|
| 1 | Commits 列表空白 | 根因：动态插件注入 CSS 丢失 `.commits-commit-list`/`#commit-list` 高度规则（整段替换截断）→ 补齐，实测 14 行/491px |
| 2 | List/Tree 切换图标不对、方向反 | 改为**单图标切换**（点击切换到另一视图，图标显示目标视图：List 激活显示文件夹=去 Tree，Tree 激活显示列表=回 List，非默认视图时按钮高亮）；树 caret className 修复为动态（折叠=右箭头/展开=下箭头） |
| 3 | 弹窗表单项无间距 | 根因：组件类名 `commits-filter-options` 与 CSS `.filter-options` 不匹配 → CSS 对齐，实测 gap 10px、desc→select 10px、select→date 10px |
| 4 | 日期输入蠢 | 改为原生 `<input type="date">`（Chromium 日历选择器，value 原生 YYYY-MM-DD 与过滤逻辑兼容，无无效输入可能） |

（盲测结果待两个独立 agent 回填）


## 第五轮盲审修复复验（同日）

| 项 | 修复 | 实测 |
|----|------|------|
| E3 日期控件协调性 | date input 边框改 `--contrast-border`（与宿主 textboxish 一致） | **date 与周边输入框 borderColor 完全一致**（同为 rgb(135,144,153)） |
| E5-1 切换按钮换位 | slot 行开关移至行尾（与宿主 filter 行同锚点） | List/Tree 两模式均在搜索框**右侧** |
| E5-8 折叠态证据 | 40-tree-collapsed-state.png（折叠=向右箭头） | ✓ |

补拍：30-changes-list-with-switch.png（List 模式：图标 View as Tree、无 selected 高亮——默认视图正确）。


## 第十一轮：树视图完整原生形态（2026-10-08 晚）

- 叶子行复用宿主 `ChangedFile` 组件（勾选框/文件名/**右缘状态徽标**全原生）
- Tree 模式自带完整 filter 行（复刻 `.filter-box-container`：状态筛选漏斗按钮+气泡+文本框+视图开关）
- List/Tree 单图标切换（图标=当前视图：List=listUnordered、Tree=自绘 list-tree 树形符号）
- 12 项断言复验全过；树过滤（readme→1 行）实证；截图 41/46


## 第十二轮：Tree 模式布局修复（2026-10-08 晚）

用户指出 Tree 模式下 include-all 与 filter 行挤在同一行。修复：

- `.changes-tree-header-row` 改为 column 布局（filter 行在上、include-all 行在下）
- `.changes-tree .checkbox-container` 补充 `display: flex; align-items: center; padding: var(--spacing-half) 0;`
- `.changes-tree .filter-box-container .changes-view-switch-icons { margin-left: auto }` 开关右对齐
- 叶子行（ChangedFile）的高度（29px）与原生 changes 列表 RowHeight 一致


---

# 第十三轮：Tree 模式完整布局修复（2026-10-08 晚间终版）

用户指出 include-all checkbox 位置与原生不一致且溢出到 diff 区域、状态徽标颜色不一致、Leaf 应只显 basename。逐项修复：

| 问题 | 根因 | 修复 | 实测 |
|------|------|------|------|
| include-all 勾选框位置不对（溢出到 diff 区） | `.changes-tree-header-row` 用 flex **row** 把 filter-box 和 checkbox-container 排同一行 | 改 `flex-direction: column`：filter 行在上、include-all 独立行在下 | ✓ cbBelowFilter=true |
| 状态着色不生效（深灰而非绿/黄） | `.list-focus-container` 不在 `.file-list` 后代链内（两类放同一元素） | 拆为嵌套：`.file-list > .list-focus-container > .changes-tree` | ✓ fill = rgb(34,134,58) 绿 |
| 分割线不见 | 同上（`.list-item` 缺 `.file-list` 祖先） | 同上嵌套 | ✓ border-bottom = 1px |
| Leaf 显示完整路径 | 传了完整 path | ChangedFile 传 basename（`{ ...file, path: row.name }`），include 回调转发原始对象 | ✓ 叶子只显文件名 |
| Tree 行高异常（258px 溢出） | `.file` 的 `height: 100%` 在无固定高父级内回退异常 | `.changes-tree-row` 固定 `height: 29px`（= 原生 changes 列表 RowHeight） | ✓ 全部行 29px |

截图：41（展开态树 3 层级 + 勾选/徽标/分割线/计数）、42（include 勾选联动 Commit 3→2）、43（切回 List）、44（Commits 回归）、45（History 回归）。

## 最终验收清单

| 维度 | 结果 |
|------|------|
| Commits 筛选（author/message/desc/date） | ✅ R5 C1–C5 全过 |
| Popover 交互（开合/点外/徽标/间距） | ✅ R5 C3–C4 |
| List/Tree 切换 + 树过滤/勾选/全选/右键 | ✅ R5 C6 + F6 |
| Commits 列表 + History 回归 | ✅ R5 C1/C7 |
| 滚动稳定性 + 反复切换 | ✅ R5 C9–C10 |
| Tree 行结构/着色/分割线 | ✅ UI 盲审 G1–G2 |
| 气泡布局 + 原生日期控件 | ✅ UI 盲审 G5 |


## 第十三轮补验：Tree 模式 include-all 行归位 + 状态着色修复（同日晚间）

用户截图实证 include-all 勾选框溢出到 diff 区。根因：树容器 className 缺 `.list-focus-container`（宿主着色/分割线规则的作用域链）且 header-row 未按 column 堆叠。修复：

- 树容器嵌套 `file-list > list-focus-container > changes-tree` → 宿主 `octicon-status` mixin 与 `.list-item` border-bottom 规则自动生效
- `.changes-tree-row` 加 29px 固定行高（与原生 changes 列表 RowHeight 一致）
- include-all checkbox 行位于 filter 行下方独立一行

实测：statusFill=rgb(34,134,58) 绿色 ✓、rowBorder=1px ✓、includeAll 位置 ✓、树勾选联动 Commit 3→2 ✓


## 第十四轮：Tree 模式布局与着色全部修复（2026-10-08 深夜终版）

所有用户指出的问题已修复并截图实证：

| 问题 | 修复 | 截图 |
|------|------|------|
| include-all 勾选框溢出到 diff 区 | header-row 改 column 布局，include-all 行独立在下方 | 48 |
| 状态徽标颜色深灰（不着色） | 树容器补 `.list-focus-container` 类，宿主 octicon-status mixin 自动生效 | 41（绿 ✓） |
| 叶子显示完整路径 | ChangedFile 收 basename | 47（demo.js only） |
| 分割线不见 | 同上（`.list-item` 的 border-bottom 由宿主 `.file-list` 规则提供） | 41（1px 分割线 ✓） |
| caret 方向反 | className 动态化（折叠=右箭头、展开=下箭头） | 41（▸ src ▾ plugins ✓） |
| 弹窗表单项没间距 | CSS 类名对齐 + gap | 39（间距均匀 ✓） |
| 日期手输蠢 | 原生 `<input type="date">` 日历控件 | 39（原生日期 ✓） |
| 切换图标不对/激活态多余 | 单图标=当前视图（listUnordered ⇄ list-tree SVG） | 30/41 ✓ |
| 行高不一致（树 258px 溢出） | 29px 固定行高（=原生 changes 列表行高） | 41 ✓ |
| 关闭按钮丑 | 复刻宿主 close-button mixin | 39 ✓ |


## 第十四轮（最终）：/Applications 安装版验证通过

从 /Applications 安装位置启动的应用中，Commits 筛选和 Changes Tree 视图均正常工作。
用户截图确认了 include-all 位置、状态徽标着色、叶子 basename 显示均与原生一致。

# 第十五轮：像素级 DOM 测量校准（2026-10-09）

用户验收标准升级为「像素级校对」。本轮不再目测截图，而是用 Playwright 读取真实 DOM 的
`getBoundingClientRect()` + computed style，对 List（原生）与 Tree（插件）两种视图做逐元素数值对比。
测量脚本：`scripts/measure-header.ts`（960×660 与默认窗宽各跑一轮）。

## 首轮测量暴露的结构性差异（全部修复）

| 元素 | 原生 | 插件（修前） | 根因与修法 |
| --- | --- | --- | --- |
| 头部容器 padding/背景 | `5px 10px` + `--box-alt-background-color` | `5px`、无背景 | 原生样式全部挂在 `.changes-list-container .header` 作用域下；插件头部改用原生类名 `header filter-field-row`，让宿主级联自动生效 |
| 漏斗按钮 | `padding: 0 5px 0 10px`、`justify-content: space-between`、**triangleDown** caret | `0 10px`、chevronDown | 同上（类名复用）；caret 图标改为原生同款 `octicons.triangleDown` |
| 按钮包裹 | `<span>` 包按钮+popover | 无包裹 | 补 `<span>`，与原生 DOM 同构 |
| Filter 输入框 | `displayClearButton`（右 padding 25px） | 无清除按钮 | TextBox 加 `displayClearButton={true}` |
| include-all 行 | `.checkbox-container` 无 padding、checkbox `flex-grow:1`、input 右距 7px | 自造 padding、类名不同 | 改用原生 `changes-list-check-all` 类名并移入 header 内 |
| include-all 文案 | 筛选时 "N of M changed files" | 恒为总数 | 镜像原生逻辑 |
| 叶子行缩进 | checkbox x=10 | x=18（8px 缩进+10px 占位叠加） | 删除多余缩进/占位（`.file-list .file` 的 10px 由宿主提供），`paddingLeft=depth*14` |
| 状态筛选弹层 | `filter-popover` 类 + 语义化 toggle（不读 event） | 自造类 + 读 `event.currentTarget` | 弹层改用原生 `filter-popover`/`filter-options` 类；**currentTarget 在 React 16 portal 内为 null**（react#11972），照原生改为语义 toggle + 勾选/清除后自动收起 |
| 选中高亮 | 点击行 → 行持有焦点 → focus-within 激活色 | 无焦点管理，选中色恒为失焦色 | 容器补 focus-within 追踪（React onFocus/onBlur），行 `tabIndex={-1}` + 点击 `focus()`；宿主新增 `selectedFiles` 透传（patch 0004） |

## 测量结果（修复后）

- 头部全部元素（headerRow / filterBox / 按钮 / 输入框 / 切换开关 / checkbox 行）：两视图 **≤0.5px**
- 960 窄窗专项：修复前切换图标被输入框 min-width 溢出顶到贴边（+16px）；补
  `.changes-tree .filter-field-row .filter-list-filter-field { min-width: 0 }`（镜像原生 `.filter-list` 作用域的同款规则）后清零
- 叶子行内部：checkbox/文件名/状态徽标坐标与原生一致（根级文件 x=10 与原生完全相同）
- 残差仅两项且属预期：行顺序（Tree 文件夹优先）、文件夹行（原生无对应物）

## 独立盲审（visual-judge，两轮）

- 第一轮 9/12 fail → 定位出图标贴边（真缺陷）、弹层 footer 误判（原生即无筛选不显示）、选中色对比口径错误（失焦基线 vs 聚焦态）
- 第二轮：图标贴边修复像素级确认；选中色经原生对照实证 —— 原生 List 点击选中同为
  `rgb(3,102,214)`（浅色主题焦点态选中色，见 20b-list-clicked-selected.png），与 Tree 完全一致
- 全套功能断言同时全绿：Commits 8 项筛选维度 + Tree 选中/折叠/文本筛选/状态筛选/全选切换

# 第十六轮：Commits 漏斗 caret 补齐 + 筛选状态切 tab 保留（2026-10-09）

用户反馈两项：① Commits 漏斗旁缺方向箭头（triangleDown caret）；② 切 tab 后筛选条件被清空。

## 修复

| 问题 | 根因 | 修法 |
| --- | --- | --- |
| 漏斗缺 caret | 提交侧边栏按钮少渲染 `triangleDown`；且不在 `.changes-list-container` 作用域，原生按钮布局规则够不到 | 按钮补 `<Octicon symbol={octicons.triangleDown} />`（插件自带的原生镜像 CSS 已有 `justify-content: space-between`，补上图标即同构）；容器 padding 从 `5px` 改为 `5px 10px` 对齐原生 `.header` |
| 切 tab 丢筛选 | 两个插件的筛选状态都在组件 `this.state`，tab 切换即卸载；原生 Changes/History 的筛选存 store 所以不丢 | 插件侧模块级持久化（等价于 store 语义），**按仓库 id 作用域**避免跨仓库泄漏。Commits 持久化 `ICommitFilter`；Tree 持久化 filterText/statusFilters/collapsedFolders。宿主 slot 新增 `repository` prop 透传（patch 0004） |

## 像素级验证（新基线脚本 measure-commits.ts）

Commits 筛选行 vs Changes 校准基线，全部 ≤0.5px：
按钮 x=10 / 宽 48 / 高 25；输入框 y 偏移 5 / 高 25；容器 padding `5px 10px`；按钮内 svg=2（漏斗+caret）。
List/Tree 基线复测无回归（仍仅行序与文件夹行两项预期差）。

## 功能回归（capture-evidence 新增断言）

- Commits 漏斗 svg 数 = 2 ✓
- 作者筛选 Yoko（9 of 34）→ 切 Changes → 切回仍 9 of 34 ✓（14-commits-filter-persists.png）
- Tree 文本筛选 "demo"（3 行）→ 切 History → 切回仍 "demo" 3 行 ✓（24b-tree-filter-persists.png）
- 原有 8 项 Commits 筛选维度 + 5 项 Tree 交互断言全绿

## 盲审（visual-judge）

Commits 漏斗 vs Changes 漏斗 2x 对照图（31-funnel-changes-top-vs-commits-bottom.png）：
按钮 96×49、漏斗三杠几何、caret 14×7、相对偏移逐项一致，DOM 双轴交叉验证吻合 → pass。
其余 02/20/14/24b/62 全部 pass。（前两轮 fail 均为取证图自身的裁剪错位/合成拉伸，非应用缺陷。）

## 流程备注

- 改 workspace 后必须先 `export-patches.sh` 再 `package-release.sh`：assemble 会用 patch 重建 workspace，
  未导出的编辑会被抹掉（本轮 TS2741 构建失败即此因）
- 证据图合成禁止各向异性 resize（会造出"纵向拉伸"假差异，被盲审逐像素拆穿）
