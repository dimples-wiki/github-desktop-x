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

> 未签名的本地构建建议 `brew install --cask --no-quarantine githubx`。
> 一行版：`brew tap dimples-wiki/githubx && brew trust dimples-wiki/githubx && brew install --cask githubx`

要求：macOS Monterey 及以上 · Apple Silicon。与官方 GitHub Desktop 可共存（应用名、userData、OAuth 协议头均隔离）。

## 这是什么

在原生体验之上新增两个**运行时插件**（删除插件目录即回到原生行为）：

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
