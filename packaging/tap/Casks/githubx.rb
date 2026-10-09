cask "githubx" do
  version "3.6.6"
  # 发布时用 scripts/package-release.sh 输出的 SHA-256 替换
  sha256 "11cd842485acd23bf678f4abe674d45f3edf37022fd0faef22070d53c2fff006"

  url "https://github.com/OWNER/github-desktop-x/releases/download/v#{version}/GitHub-Desktop-X-#{version}-macOS-arm64.zip",
      verified: "github.com/OWNER/github-desktop-x"
  name "GitHub Desktop X"
  desc "GitHub Desktop fork with a native-feeling, filterable Commits tab"
  homepage "https://github.com/OWNER/github-desktop-x"

  livecheck do
    url :homepage
    strategy :github_latest
  end

  depends_on macos: ">= :monterey"
  depends_on arch: :arm64

  # 与官方 GitHub Desktop 共存：
  # - 应用名不同（GitHub Desktop X.app），互不覆盖
  # - 默认 userData 目录随 productName 变为 ~/Library/Application Support/GitHub Desktop X
  # - OAuth 协议头为 x-github-desktop-dev-auth（官方用 x-github-desktop-auth），互不劫持
  app "GitHub Desktop X.app"

  # 产物为 ad-hoc 签名（本地验证通过；公开发布需替换为开发者签名+公证，
  # 参见仓库 docs/FEASIBILITY-BREW-PLUGIN.md）。未公证的安装建议：
  #   brew install --cask --no-quarantine githubx
  zap trash: [
    "~/Library/Application Support/GitHub Desktop X",
  ]
end
