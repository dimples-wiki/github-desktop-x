# Homebrew Tap：github-desktop-x

让用户通过 Homebrew 一条命令安装带 Commits 筛选功能的 GitHub Desktop 二开版：

```bash
brew tap OWNER/github-desktop-x https://github.com/OWNER/github-desktop-x
brew install --cask github-desktop-x
# 未公证的本地构建建议：
brew install --cask --no-quarantine github-desktop-x
```

## 本地验证（不发布到 GitHub 也能测）

```bash
# 1) 产出发布包（zip + sha256）
./scripts/package-release.sh

# 2) 建一个本地 tap 指向本仓库的 packaging/tap
brew tap-new --no-git local/dimple 2>/dev/null || true
ln -s "$(pwd)/packaging/tap/Casks" "$(brew --repository)/Library/Taps/local/homebrew-dimple/Casks"

# 3) 把 cask 里的 url 换成 file:// 本地路径后安装测试
brew install --cask --no-quarantine local/dimple/github-desktop-x
```

## 与官方 GitHub Desktop 的共存设计

| 维度 | 官方版 | 本二开版 |
|------|--------|----------|
| 应用名 | GitHub Desktop.app | GitHub Desktop Dimple.app |
| userData | ~/Library/Application Support/GitHub Desktop* | ~/Library/Application Support/GitHub Desktop Dimple |
| OAuth 协议 | x-github-desktop-auth | x-github-desktop-dev-auth |
| 更新 | Squirrel 自动更新（官方服务器） | 更新指向无效地址（静默）；升级 = 改 submodule 重放补丁后重新发版 |

bundle ID 暂与官方一致（com.github.GitHubClient，跟随上游）；若需要更彻底的隔离
（TCC 权限/LaunchServices 完全分离），在胶水补丁 0006 中把 app/package.json 的
`bundleID` 一并改掉即可（副作用：需同步评估 OAuth 回调注册）。

## 公开发布清单

1. Apple Developer 签名 + 公证（替换 ad-hoc）：`scripts/package-release.sh` 中
   打包通道改 production 并提供 `CSC_NAME`（上游 build.ts 会走 osxSign distribution + osxNotarize）。
2. zip 上传 GitHub Releases（tag = v<version>），把真实 sha256 写进 cask。
3. cask 中 `OWNER` 替换为实际 GitHub 用户/组织。
4. （可选）向 homebrew-cask 提交 PR，或维持独立 tap。
