# dimple-github-desktop 开发方案（PLAN）

> 目标：以 **git submodule + 最小胶水补丁 + 独立功能模块** 的方式对 GitHub Desktop 二开，
> 在 History 旁新增 **Commits** 标签页：复用原生提交列表，增加筛选能力（提交人 / message 模糊搜索 / 描述搜索 / 时间范围），筛选范围天然限定为当前选中分支。
> 追求「像原生自带」的 UI 一致性，且官方升级时只需维护胶水层。

## 1. 总体架构

```
dimple-github-desktop/               ← 父仓库（我们的二开仓库）
├── upstream/                        ← git submodule：desktop/desktop，锁定 release-3.6.6（浅克隆）
├── feature/                         ← 独立功能模块（只包含「新增文件」，路径与上游一一对应）
│   └── commits-filter/
│       ├── app/src/ui/history/commits-sidebar.tsx ← Commits 标签页 UI（容器、筛选栏）
│       ├── app/src/ui/history/commits-filter-logic.ts ← 纯函数过滤逻辑（高内聚、可单测、可扩展）
│       ├── app/styles/ui/…          ← 新增样式（复用上游设计变量/类名规范）
│       └── app/test/unit/commits/…  ← 过滤逻辑单元测试
├── patches/                         ← 胶水补丁序列（对上游的**最小侵入**，全部为加法式小改动）
│   ├── 0001-….patch …
│   └── series.txt
├── scripts/
│   ├── assemble.sh                  ← 组装 workspace：上游 checkout + apply 补丁 + rsync 功能模块
│   ├── make-fixture-repo.sh         ← 生成本地测试仓库（多作者/多日期/多行描述）
│   └── cdp/                         ← 基于 CDP(远程调试协议) 的 GUI 自动化与截图工具
├── docs/                            ← PLAN / PROGRESS / VERIFICATION
└── screenshots/                     ← 真实运行截图（验收证据）
```

### 为什么这样分层（可升级性）

- `upstream/` 保持**零污染**（detached 在官方 tag 上）；
- 上游侧改动全部收敛为**通用插件框架接线**：`framework/app/src/lib/extensions/`（`extension-points.ts` 注册 API + `built-in-manifest.ts` 纯数据清单，主进程/渲染进程共用）随基线注入；`patches/` 只含「上游文件如何消费扩展点」的通用改动（动态 tab 渲染/路由/聚焦、section 刷新语义、清单驱动菜单）——**不含任何 Commits 业务逻辑**；
- 全部业务逻辑/组件/样式都在 `feature/`，以 `registerRepositorySection({ id, title, sidebarComponent, refreshOnActivate })` **自注册为插件**（`app/src/lib/extensions/built-in/`，overlay 注入，不进补丁）；
- 上游更新时：升级 submodule → 重放补丁（冲突只可能出现在框架接线点）→ `assemble.sh` 重组装；
- **新增第二个插件** = manifest 加一行 + `built-in/` 加一个模块 + `register()` 调用，上游侧零改动；
- 「插件化」的实质：胶水层 = **扩展点框架**（对上游通用），功能层 = 自注册插件（业务自包含）。

### 组装流程（scripts/assemble.sh）

```
upstream@tag  ──git worktree/checkout──▶  workspace/
patches/*.patch ──git apply──▶           workspace/（注入注册点）
feature/commits-filter/* ──rsync──▶      workspace/（注入功能模块）
workspace/: yarn install && 构建运行
```

## 2. 功能设计：Commits 标签页

### UI
- TabBar 中 `Changes | History` 之后新增 `Commits`（第三个 tab），仅在仓库上下文出现（与 History 同条件），文案/间距/选中态完全复用上游 `TabBar`/`Tab` 组件。
- 页面结构自上而下：
  1. **筛选栏**（复用上游 `TextInput`/`Select`/`Button` 等原生组件与样式变量）：
     - Author：下拉（数据来自当前分支已加载提交的去重作者，含头像，样式对齐上游列表项）；
     - Message 搜索框：大小写不敏感、按空白分词 AND 匹配（模糊搜索）；
     - Description 搜索框：匹配提交正文（commit body）；
     - Date range：`YYYY-MM-DD ~ YYYY-MM-DD` 两个输入框（严格解析校验，非法输入不高亮结果、不崩溃）；
     - 结果计数 + 一键 Clear filters。
  2. **提交列表**：直接复用上游 `CommitList`（含头像、提交号、选中态、键盘导航、空态文案）。
  3. 选中提交后右侧与 History 完全一致（复用 `CommitSummary` + `FileList`，即点开 diff 的体验原生一致）。
- 滚动到底自动加载更多提交（复用 `loadHistoryBatch` 机制），筛选作用于「当前分支已加载提交集合」，并在 UI 上提示已筛选的条数。

### 过滤语义（commit-filter.ts，纯函数）
```ts
interface ICommitFilter {
  authors: string[]      // 精确匹配 author.name（多选）
  messageTerms: string[] // 空白分词，对 summary 大小写不敏感 AND 匹配
  descriptionTerm: string// 对 body 大小写不敏感子串匹配
  dateFrom?: string      // YYYY-MM-DD（含）
  dateTo?: string        // YYYY-MM-DD（含）
}
filterCommits(commits: Commit[], filter: ICommitFilter): Commit[]
```
- 空过滤器 = 原样返回全量；各维度可独立组合；
- 提供对应的单元测试覆盖：单维度、组合、边界（非法日期、空仓库、作者大小写）。
- 扩展边界说明：新增「提交元数据」维度（作者/日期/正文/标签等 Commit 模型已有字段）只需修改 feature/ 内文件；若要按「变更文件路径」筛选，则需要上游数据层支持（Commit 模型不含文件列表），属于新增胶水的数据管道扩展。

### 状态与数据流
- 提交数据**不另起炉灶**：直接读取上游 `RepositoryStore` 已有的 `historyState`（`commitLookup` + `commitSHAs`，本身即「当前选中分支」的提交序列）；
- 筛选状态为 Commits 页组件内部 state（结构化对象），切换仓库时自然重置；数据流与上游 History 一致（props 自 `repository.tsx` 下传）。

## 3. 胶水插入点（以源码勘探结果为准，见 PROGRESS 勘探记录）

| # | 插入点 | 预期文件 | 改动量级 |
|---|--------|----------|----------|
| G1 | `RepositoryTab` 枚举新增 `Commits` | app/src/lib/…(tab 枚举) | +1 行 |
| G2 | TabBar 渲染新增 `<Tab>Commits</Tab>` | app/src/ui/repository/repository.tsx | +3 行 |
| G3 | tab 切换路由 case → 渲染 `<CommitsTab>` | 同上 | +2 行 |
| G4 | 传入 Commits 页所需 props（historyState 等） | 同上 | +2 行 |
| G5 | 样式表 import 功能模块 scss | app/styles/desktop.scss | +1 行 |
| G6 | ⌘3 快捷键聚焦（对齐 ⌘1/⌘2 体验，可选加分项） | 快捷键注册处 | +2 行 |

## 4. 验收标准（Acceptance Criteria）

用户三维度 + 补充项，全部需通过**独立子 agent 盲测**：

- **A. 功能完整可用（盲测 agent #1，只给操作手册不给实现代码）**
  - A1 Commits tab 出现在 History 旁，选中态/切换行为与原生 tab 一致；
  - A2 列表与 History 数据一致（当前分支）；
  - A3 按提交人筛选正确（含多作者去重、筛选结果正确）；
  - A4 message 模糊搜索正确（大小写不敏感、多词 AND）；
  - A5 描述（正文）搜索正确；
  - A6 时间范围筛选正确（含边界、非法输入不崩溃）；
  - A7 组合筛选正确；Clear filters 一键还原；结果计数正确；
  - A8 点开筛选出的提交，右侧 diff/详情与 History 体验一致；
  - A9 滚动加载更多在筛选下表现正常；
  - A10 不影响原有 Changes/History 全部功能（回归）。
- **B. 高内聚低耦合可拓展（盲测 agent #2，只读 feature/ + patches/ + 组装脚本）**
  - B1 功能模块自包含，除胶水补丁外无对上游文件的散点修改；
  - B2 胶水补丁最小化（总行数量级：~15 行内，纯加法为主）；
  - B3 过滤逻辑为纯函数且有单测；新增筛选项（如按文件路径）有清晰扩展点；
  - B4 assemble 流程可重复执行（幂等），submodule 升级演练可行。
- **C. UI 一致性（盲测 agent #3，只看 History vs Commits 截图对比）**
  - C1 tab 视觉（字体/间距/选中态）与原生无差异；
  - C2 筛选控件风格与上游输入框/下拉一致（圆角、边框、焦点态）；
  - C3 列表项、空态、详情面板与 History 观感一致；
  - C4 整体「像原生自带」，无第三方风格混入。
- **D. 真实证据**：GUI 实机运行截图（非 mock），覆盖每个筛选维度 + 组合 + 原生对比。

## 5. 开发计划（阶段）

| 阶段 | 内容 | 状态 |
|------|------|------|
| D0 | 环境（Node20/Yarn1）、父仓库、submodule 锁定 release-3.6.6 | ✅ |
| D1 | 源码勘探：精确定位 G1~G6 插入点、状态流、样式规范、测试框架 | ⏳ |
| D2 | assemble 脚本 + 基线构建（未加功能先跑通上游构建/启动） | ⏳ |
| D3 | commit-filter 纯逻辑 + 单测 | ⏳ |
| D4 | Commits UI 模块 + 胶水补丁 + 样式 | ⏳ |
| D5 | 测试夹具仓库（多作者/日期/描述）+ CDP 驱动工具 | ⏳ |
| D6 | 实机 GUI 验证 + 截图 + 打磨迭代 | ⏳ |
| D7 | 三维盲测验收 + 修复 + submoudule 升级演练 + 总结 | ⏳ |

> 进度明细见 [PROGRESS.md](./PROGRESS.md)，验收记录见 [VERIFICATION.md](./VERIFICATION.md)。
