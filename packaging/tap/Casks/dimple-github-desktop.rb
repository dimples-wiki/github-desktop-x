cask "dimple-github-desktop" do
  version "3.6.6"
  # 发布时用 scripts/package-release.sh 输出的 SHA-256 替换
  sha256 :no_check

  url "https://github.com/OWNER/dimple-github-desktop/releases/download/v#{version}/GitHub-Desktop-Dimple-#{version}-macOS-arm64.zip",
      verified: "github.com/OWNER/dimple-github-desktop"
  name "GitHub Desktop Dimple"
  desc "GitHub Desktop fork with a native-feeling, filterable Commits tab"
  homepage "https://github.com/OWNER/dimple-github-desktop"

  livecheck do
    url :homepage
    strategy :github_latest
  end

  depends_on macos: ">= :monterey"
  depends_on arch: :arm64

  # 与官方 GitHub Desktop 共存：
  # - 应用名不同（GitHub Desktop Dimple.app），互不覆盖
  # - 默认 userData 目录随 productName 变为 ~/Library/Application Support/GitHub Desktop Dimple
  # - OAuth 协议头为 x-github-desktop-dev-auth（官方用 x-github-desktop-auth），互不劫持
  app "GitHub Desktop Dimple.app"

  # 产物为 ad-hoc 签名（本地验证通过；公开发布需替换为开发者签名+公证，
  # 参见仓库 docs/FEASIBILITY-BREW-PLUGIN.md）。未公证的安装建议：
  #   brew install --cask --no-quarantine dimple-github-desktop
  zap trash: [
    "~/Library/Application Support/GitHub Desktop Dimple",
  ]
end
