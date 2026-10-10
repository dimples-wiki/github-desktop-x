<p align="center">
  <img src="packaging/icon/app-icon-1024.png" width="120" alt="GitHub Desktop X">
</p>

<h1 align="center">GitHub Desktop X</h1>

<p align="center">
  <a href="https://github.com/dimples-wiki/github-desktop-x/releases/latest"><img src="https://img.shields.io/github/v/release/dimples-wiki/github-desktop-x?style=flat-square&color=black" alt="version"></a>
  <img src="https://img.shields.io/badge/platform-macOS%20Apple%20Silicon-black?style=flat-square" alt="platform">
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="license">
</p>

<p align="center">
  GitHub Desktop（<a href="https://github.com/desktop/desktop">desktop/desktop</a>）的二开版：<br>
  动态插件架构 —— 上游只含扩展点，功能全部以运行时插件交付。
</p>

## 安装

```bash
brew tap dimples-wiki/githubx
brew trust dimples-wiki/githubx   # Homebrew 7+ 需显式信任第三方 tap
brew install --cask githubx
```

> 一行版：`brew tap dimples-wiki/githubx && brew trust dimples-wiki/githubx && brew install --cask githubx`
>
> 安装尾声会请求一次管理员密码（移除隔离标记，应用未做 Apple 公证）——输入后 Gatekeeper 不再拦截，
> 无需任何额外操作。

要求：macOS Monterey 及以上 · Apple Silicon。与官方 GitHub Desktop 可共存（应用名、userData、OAuth 协议头均隔离）。

## 这是什么

在原生体验之上新增两个**内置插件**（随应用分发，开箱即用）：

- **Commits 标签页** —— 复用原生提交列表，支持按提交人 / message 模糊 / 描述正文 / 时间范围筛选，跨 tab 筛选状态保留
- **Changes Tree 视图** —— 文件列表的目录树形态，折叠/展开、树内筛选；List ↔ Tree 图标一键切换，与原生列表像素级一致

两项能力均通过独立盲测（visual-judge 13/13）+ 像素级 DOM 测量（与原生 ≤0.5px）+ 启动零报错门槛。

## 架构

```
upstream/      git submodule：desktop/desktop @ release-3.6.6（零功能改动）
framework/     扩展点：tab 注册、Changes 文件视图插槽、插件加载器（新文件）
patches/       胶水补丁（0001–0008，全部接线/注册性质，可审计）
plugins/       动态插件源码（commits-filter、changes-tree，esbuild IIFE）
scripts/       组装 / 发布 / 验收（像素测量、启动零报错扫描、录屏、GUI 驱动）
docs/          PLAN · PROGRESS · VERIFICATION（16+ 轮验收记录）
workspace/     组装产物（gitignore，不入库）
```

工作方式：`assemble.sh` 用上游树 + 补丁 + framework 组装出可构建的 workspace →
插件经 esbuild 打包后由主进程扫描、IPC 下发、renderer eval 注册 ——
**上游不感知插件，官方升级只需维护胶水层**。

## 插件：内置 + 动态加载

应用启动时会扫描插件目录并动态注册。**内置的两个插件随应用分发、缺失时自动恢复**；
你也可以按同样的方式加载自己的插件。

### 动态加载一个插件

把插件放进插件目录后重启应用：

```bash
# macOS
~/Library/Application Support/GitHub Desktop X/plugins/<plugin-id>/
├── plugin.json    # {"id":"my-plugin","title":"My Plugin","accelerator":""}
└── renderer.js    # esbuild 打包产物（IIFE）
```

- `plugin.json` 的 `accelerator` 是可选的全局快捷键（如 `CmdOrCtrl+Shift+Y`）
- 删除插件目录并重启即卸载；内置插件删除后会在下次启动时自动恢复

### 开发一个插件

插件运行在 renderer 进程，顶层调用扩展点即可注册能力：

```js
// 仓库页新增一个标签页
globalThis.__GHD_EXTENSION_API__.registerRepositorySection({
  id: 'my-plugin', title: 'My Plugin',
  sidebarComponent: MySidebar,        // React 组件
  refreshOnActivate: 'history',
})

// 或：替换 Changes 页的文件列表视图
globalThis.__GHD_EXTENSION_API__.registerChangesFileView({
  id: 'my-view', title: 'My View', component: MyView,
})
```

运行时 API（`globalThis.__GHD_EXTENSION_API__`）提供 React、宿主组件
（`Button` `TextBox` `Checkbox` `Select` `Popover` `Octicon` `ChangedFile` `CommitList`）、
`octicons` 图标集与 `log`。**复用宿主组件与原生类名**是与原生体验保持一致的关键。

完整可运行的参考实现见 [`plugins/`](plugins/)：
[`commits-filter`](plugins/commits-filter/src/commits-sidebar.tsx)（标签页插件）
与 [`changes-tree`](plugins/changes-tree/src/index.tsx)（视图插件）。

本地迭代：把开发目录指给应用（免拷贝）——

```bash
DIMPLE_PLUGINS_DIR=/path/to/my-plugins open -a "GitHub Desktop X" --args --cli-open=你的仓库
```

打包：`esbuild src/index.tsx --bundle --format=iife --platform=browser
--jsx=transform --jsx-factory=React.createElement --outfile=renderer.js`。

## 从源码构建

```bash
source ~/.local/github-desktop-x-env.sh   # node 24 + yarn 1.22（自备）
./scripts/assemble.sh                     # 组装 workspace（幂等）
cd workspace && yarn install              # 首次较慢
DESKTOP_SKIP_PACKAGE=1 NODE_ENV=production RELEASE_CHANNEL=production yarn build:prod
./scripts/package-release.sh              # 产出 zip + 自动钉 sha256 进 cask
```

## 验收

- 功能：GUI 自动化断言 18 项全绿（`scripts/gui/capture-evidence.js`）
- 像素：List vs Tree、Commits vs Changes 逐元素 ≤0.5px（`scripts/measure-*.ts`）
- 启动：零报错扫描 + 录屏（`scripts/launch-error-scan.ts` / `launch-recording.ts`）
- 详见 [docs/VERIFICATION.md](docs/VERIFICATION.md)

## License

MIT（跟随上游）。GitHub Desktop 是 GitHub, Inc. 的商标，本项目与其无隶属关系。
