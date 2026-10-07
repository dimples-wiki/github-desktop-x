# dimple-github-desktop

GitHub Desktop（[desktop/desktop](https://github.com/desktop/desktop)）的二开项目：
在 History 旁新增 **Commits** 标签页——复用原生提交列表，支持按 **提交人 / message 模糊搜索 / 描述 / 时间范围** 筛选（范围天然限定为当前选中分支）。

采用 **git submodule + 最小胶水补丁 + 独立功能模块** 架构，官方升级时只需维护胶水层。

```
upstream/      git submodule：desktop/desktop @ release-3.6.6
feature/       自有功能模块（全部为新增文件）
patches/       胶水补丁序列（5 个，净 +90 行，全部注册/接线性质）
scripts/       组装 / 补丁导出 / 夹具仓库 / GUI 驱动
docs/          PLAN（方案）· PROGRESS（进度）· VERIFICATION（验收记录）
screenshots/   实机运行截图（功能证据）
workspace/     组装产物（gitignore，不入库）
```

## 快速上手

```bash
# 0) 工具链（node 24 + yarn 1.22，无需 sudo）
source /Users/yoko/.local/dimple-env.sh

# 1) 组装 workspace（上游树 + 胶水补丁 + 功能模块；幂等，保留已装依赖）
./scripts/assemble.sh

# 2) 安装依赖（首次较慢；yarn 会装两层：根 + app/）
cd workspace && yarn install

# 3) 构建（与上游 e2e 相同的免打包产物，出口 workspace/out）
DESKTOP_SKIP_PACKAGE=1 DESKTOP_E2E=1 \
DESKTOP_E2E_UPDATES_URL=http://127.0.0.1:9/update \
NODE_ENV=production RELEASE_CHANNEL=production yarn build:prod

# 4) GUI 冒烟（playwright 驱动 Electron，自动打开 demo 仓库）
node ../scripts/gui/driver.js smoke

# 单元测试（过滤纯逻辑，18 个用例）
yarn test:unit app/test/unit/commits-filter-logic-test.ts
```

## 日常开发流

- **改功能代码**：编辑 `feature/commits-filter/...` → `./scripts/assemble.sh` → 构建。
- **改胶水**：在 workspace 里改上游文件（或改 `scripts/apply-glue.py` 后执行）→
  `./scripts/export-patches.sh` 重新导出补丁 → 提交父仓库。
- **官方升级**：
  ```bash
  git -C upstream fetch --depth 1 origin refs/tags/release-X.Y.Z:refs/tags/release-X.Y.Z
  git -C upstream checkout --detach release-X.Y.Z
  git -C upstream submodule update --init
  ./scripts/assemble.sh     # 补丁冲突会在这里暴露，修复后 export-patches 重导
  ```
- **测试夹具**：`./scripts/make-fixture-repo.sh`（34 提交 / 4 作者 / 多行正文 / 特性分支）。

## 文档

- [docs/PLAN.md](docs/PLAN.md) — 架构方案、插入点、验收标准
- [docs/PROGRESS.md](docs/PROGRESS.md) — 进度与关键决策（含踩坑记录）
- [docs/VERIFICATION.md](docs/VERIFICATION.md) — 三维盲测验收记录与截图清单
