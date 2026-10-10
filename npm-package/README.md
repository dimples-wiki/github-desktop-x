# @dimples-wiki/githubx

[GitHub Desktop X](https://github.com/dimples-wiki/github-desktop-x) 的安装器 / 启动器。

```bash
npx @dimples-wiki/githubx
```

- 应用缺失：从 GitHub Releases 下载最新 zip → 解压到 /Applications → 启动
- 应用已装：直接启动；`--update` 强制拉取最新版覆盖安装
- 下载与解压全程走命令行，不产生 Gatekeeper 隔离标记（无需签名放行）

要求：macOS · Apple Silicon · Node ≥ 18。
