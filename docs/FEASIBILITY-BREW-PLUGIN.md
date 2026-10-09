# 可行性报告：brew 安装「插件」扩展官方 GitHub Desktop

> 结论先行：**「官方 app 原封不动 + `brew install` 一个插件 → 功能内嵌官方 UI」这一理想形态，以当前上游架构无法产品化实现**。
> 最接近理想的真实路径是 **方案 A：`brew tap` + cask 安装二开版 app（与官方版共存）**，本仓库已产出全部物料并实机验证。
> 全文基于对 upstream release-3.6.6 源码的逐项查证，非推测。

## 1. 决定性的四个源码事实

| # | 事实 | 出处 | 影响 |
|---|------|------|------|
| F1 | **没有任何插件/扩展机制**。全源码无 plugin/extension API（连 i18n 框架都没有，字符串是硬编码字面量） | 全量搜索 `plugin-api|extension-api|loadPlugin|registerExtension` = 0 命中 | 第三方代码没有官方加载入口，一切"插件"都只能是 hack |
| F2 | **官方包 `asar: false`**，应用 JS 以松散文件打进 .app，且未启用 ASAR 完整性 fuse（上游留有 TODO "Probably wanna enable this down the road"） | `script/build.ts:184` | 原地篡改官方 app 的 JS **在文件层面可行**（这是双刃剑：方案 B 的可行性来源，也是上游随时会关掉的窗口） |
| F3 | **Squirrel.Mac 自动更新会整体替换 .app** | `app/src/main-process/main.ts:141+`（handleSquirrelEvent）、`app/src/lib/stores/updates/` | 任何原地补丁都会在下一次自动更新时被静默抹掉 |
| F4 | **生产包渲染进程无 Node 集成**，且打包后 webpack 模块注册表不暴露于全局 | Electron 安全基线 + 产物 `out/renderer.js`（IIFE，无全局 require） | 通过 CDP 注入的外部脚本**拿不到 Dispatcher/React 状态**，无法复刻「与 History 共享状态的原生 tab」 |

另有签名约束：官方 .app 由 GitHub 签名 + hardened runtime（`script/build.ts:210-222`），`DYLD_INSERT_LIBRARIES` 注入被禁；篡改 Resources 会破坏签名 seal（可执行体签名仍有效，本机已安装场景通常可继续运行，但任何 Gatekeeper 严格化/企业策略都会拦）。

## 2. 四条路线逐评估

### ❌ 理想形态（官方 app 不动 + brew 插件内嵌官方 UI）
不存在官方入口（F1），只能走 B 或 C，两者都达不到产品质量（见下）。**不可行。**

### ✅ 方案 A（推荐，已交付物料）：brew tap + cask 安装二开版
- 形态：`brew tap <user>/dimple && brew install --cask github-desktop-x` —— 一条命令装机，与官方版**共存**（bundle 名 `GitHub Desktop Dimple`、协议头 `x-github-desktop-dev-auth`（dev 通道专用，不劫持官方的 `x-github-desktop-auth`）、更新检查静默不会被官方更新劫持）。
- 依据：本仓库已跑通完整打包并**实机验证**——`dist/GitHub Desktop Dimple.app`（699MB，ad-hoc+hardened 签名，`codesign --verify --deep` 通过），直接启动打包二进制的 GUI 冒烟通过（Commits 标签页、message 筛选均正常，截图 `screenshots/14-packaged-app-smoke.png`）。
- 物料：`scripts/package-release.sh`（一条命令产出发布 zip + sha256）、`packaging/tap/Casks/github-desktop-x.rb`（cask）、`packaging/README.md`（本地 tap 验证法 + 共存设计 + 公开发布清单）。
- 代价：用户装的是**二开版本体**而非官方版的附件；官方版与二开版是两个并排的 app。
- 公开发布的前置：需要 Apple Developer 签名 + 公证（否则用户需 `--no-quarantine`）；桌面应用用 GitHub Releases 托管 zip，cask 指向 release 下载。

### ⚠️ 方案 B（实验性 hack，不建议）：brew 的 post_install 原地补丁官方 app
- 思路：cask/formula 安装一个脚本，把 Commits 功能的 JS 注入官方 `GitHub Desktop.app` 的松散资源（F2 使其文件层面可行），再 ad-hoc 重签。
- 致命伤：**F3 自动更新抹掉补丁**（且更新时机不可控，注入与更新存在竞争窗口）；上游按 TODO 启用 asar+fuse 后**永久失效**；破坏官方签名（企业设备/严格 Gatekeeper 直接判 damaged）。
- 结论：只配作为一次性的技术演示，不配当产品。

### ❌ 方案 C（降级体验，不建议作为主路径）：CDP 运行时注入
- 思路：brew 装一个伴生启动器，以 `--remote-debugging-port` 启动**未修改的官方 app**，通过 CDP 向渲染进程注入 JS，动态在 DOM 里加"Commits"视图。
- 技术上能跑（Chromium 调试端口在打包版仍可用，F4 之外无阻拦），但：注入脚本**无 Node、无模块注册表（F4）**→ 拿不到 Dispatcher，只能自建 git 数据层 + DOM 外挂 UI；深度集成（原生 TabBar、共享选中态、右键菜单、diff 复用）全部做不到；上游任何 UI 重构都会碎；且必须经伴生器启动而非用户直接点图标。
- 结论：这是"外挂皮肤"不是"插件"，与「像原生自带」的目标根本冲突。

### 🎯 方案 D（终局正解，长期）：给上游提 extension-points PR
- 把我们 `patches/` 里的注册点（RepositorySectionTab 枚举、TabBar 分支、section 路由、菜单项）做成上游可接受的扩展 API（如 `registerRepositorySection()`）。
- 本仓库的 feature/ + patches/ 结构**就是这个 PR 的现成形态**：一旦上游合并，方案 A 的产物即自动升级为真正的"官方 app + 官方插件体系"，届时才存在理想的 brew 插件形态。

## 3. 给用户的建议

1. **现在就用方案 A**（物料齐备，见 `packaging/cask/` 与 `scripts/package-release.sh`）：体验上是"一条 brew 命令装好带 Commits 筛选的 GitHub Desktop"，与官方版并排共存。
2. 若坚持「官方 app 不动」：只能接受方案 C 的降级演示（DOM 外挂、无原生状态），不建议投入。
3. 中期把 extension-points 提案（连带本仓库的胶水补丁作为最小实现）提给上游 desktop/desktop —— 这是唯一能抵达理想形态的路径。

## 附：本次查证的关键位置

- `script/build.ts:184` — `asar: false` + TODO
- `script/build.ts:210-222` — osxSign：development 通道 ad-hoc（identity '-'），publishable 需 distribution + 公证
- `script/dist-info.ts` / `app/package-info.ts` — 通道与命名（development → 协议头 `-dev` 后缀）
- `app/src/main-process/main.ts:141+` — Squirrel 更新事件
- 全源码搜索插件机制 = 0 命中
