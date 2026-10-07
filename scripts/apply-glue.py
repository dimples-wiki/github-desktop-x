#!/usr/bin/env python3
"""在 workspace 中应用 Commits 标签页的最小胶水改动。

每个锚点(old)必须恰好出现一次，否则中止且不落盘，保证胶水补丁的确定性。
胶水改动随后由 export-patches.sh 导出为 patches/*.patch —— 本脚本仅用于开发期
生成补丁，正式组装只依赖 patches/。
"""
import sys
from pathlib import Path

WS = Path(__file__).resolve().parent.parent / "workspace"

# (相对路径, old, new, 期望出现次数)
EDITS = [
    # ---- G1: RepositorySectionTab 枚举新增 Commits ----
    (
        "app/src/lib/app-state.ts",
        "export enum RepositorySectionTab {\n  Changes,\n  History,\n}",
        "export enum RepositorySectionTab {\n  Changes,\n  History,\n  Commits,\n}",
        1,
    ),
    # ---- G2: repository.tsx —— 导入、Tab 枚举、ref/焦点、TabBar、路由 ----
    (
        "app/src/ui/repository.tsx",
        "import { SelectedCommits, CompareSidebar } from './history'",
        "import { SelectedCommits, CompareSidebar } from './history'\n"
        "import { CommitsSidebar } from './history/commits-sidebar'",
        1,
    ),
    (
        "app/src/ui/repository.tsx",
        "const enum Tab {\n  Changes = 0,\n  History = 1,\n}",
        "const enum Tab {\n  Changes = 0,\n  History = 1,\n  Commits = 2,\n}",
        1,
    ),
    (
        "app/src/ui/repository.tsx",
        "  private readonly changesSidebarRef = React.createRef<ChangesSidebar>()\n"
        "  private readonly compareSidebarRef = React.createRef<CompareSidebar>()\n"
        "\n"
        "  private focusHistoryNeeded: boolean = false\n"
        "  private focusChangesNeeded: boolean = false",
        "  private readonly changesSidebarRef = React.createRef<ChangesSidebar>()\n"
        "  private readonly compareSidebarRef = React.createRef<CompareSidebar>()\n"
        "  private readonly commitsSidebarRef = React.createRef<CommitsSidebar>()\n"
        "\n"
        "  private focusHistoryNeeded: boolean = false\n"
        "  private focusChangesNeeded: boolean = false\n"
        "  private focusCommitsNeeded: boolean = false",
        1,
    ),
    (
        "app/src/ui/repository.tsx",
        "  public setFocusChangesNeeded(): void {\n"
        "    this.focusChangesNeeded = true\n"
        "  }",
        "  public setFocusChangesNeeded(): void {\n"
        "    this.focusChangesNeeded = true\n"
        "  }\n"
        "\n"
        "  public setFocusCommitsNeeded(): void {\n"
        "    this.focusCommitsNeeded = true\n"
        "  }",
        1,
    ),
    (
        "app/src/ui/repository.tsx",
        "    const selectedTab =\n"
        "      this.props.state.selectedSection === RepositorySectionTab.Changes\n"
        "        ? Tab.Changes\n"
        "        : Tab.History",
        "    const selectedTab =\n"
        "      this.props.state.selectedSection === RepositorySectionTab.Changes\n"
        "        ? Tab.Changes\n"
        "        : this.props.state.selectedSection === RepositorySectionTab.Commits\n"
        "          ? Tab.Commits\n"
        "          : Tab.History",
        1,
    ),
    (
        "app/src/ui/repository.tsx",
        "        <div className=\"with-indicator\" id=\"history-tab\">\n"
        "          <span>History</span>\n"
        "        </div>\n"
        "      </TabBar>",
        "        <div className=\"with-indicator\" id=\"history-tab\">\n"
        "          <span>History</span>\n"
        "        </div>\n"
        "\n"
        "        <div className=\"with-indicator\" id=\"commits-tab\">\n"
        "          <span>Commits</span>\n"
        "        </div>\n"
        "      </TabBar>",
        1,
    ),
    (
        "app/src/ui/repository.tsx",
        "        preferAbsoluteDates={this.props.preferAbsoluteDates}\n"
        "      />\n"
        "    )\n"
        "  }\n"
        "\n"
        "  private renderSidebarContents(): JSX.Element {",
        "        preferAbsoluteDates={this.props.preferAbsoluteDates}\n"
        "      />\n"
        "    )\n"
        "  }\n"
        "\n"
        "  private renderCommitsSidebar(): JSX.Element {\n"
        "    return (\n"
        "      <CommitsSidebar\n"
        "        ref={this.commitsSidebarRef}\n"
        "        repository={this.props.repository}\n"
        "        state={this.props.state}\n"
        "        dispatcher={this.props.dispatcher}\n"
        "        emoji={this.props.emoji}\n"
        "        accounts={this.props.accounts}\n"
        "        onRevertCommit={this.onRevertCommit}\n"
        "        onAmendCommit={this.onAmendCommit}\n"
        "        onViewCommitOnGitHub={this.props.onViewCommitOnGitHub}\n"
        "        onCherryPick={this.props.onCherryPick}\n"
        "        askForConfirmationOnCheckoutCommit={\n"
        "          this.props.askForConfirmationOnCheckoutCommit\n"
        "        }\n"
        "        preferAbsoluteDates={this.props.preferAbsoluteDates}\n"
        "      />\n"
        "    )\n"
        "  }\n"
        "\n"
        "  private renderSidebarContents(): JSX.Element {",
        1,
    ),
    (
        "app/src/ui/repository.tsx",
        "    if (selectedSection === RepositorySectionTab.Changes) {\n"
        "      return this.renderChangesSidebar()\n"
        "    } else if (selectedSection === RepositorySectionTab.History) {\n"
        "      return this.renderCompareSidebar()\n"
        "    } else {",
        "    if (selectedSection === RepositorySectionTab.Changes) {\n"
        "      return this.renderChangesSidebar()\n"
        "    } else if (selectedSection === RepositorySectionTab.History) {\n"
        "      return this.renderCompareSidebar()\n"
        "    } else if (selectedSection === RepositorySectionTab.Commits) {\n"
        "      return this.renderCommitsSidebar()\n"
        "    } else {",
        1,
    ),
    (
        "app/src/ui/repository.tsx",
        "    if (selectedSection === RepositorySectionTab.Changes) {\n"
        "      return this.renderContentForChanges()\n"
        "    } else if (selectedSection === RepositorySectionTab.History) {\n"
        "      return this.renderContentForHistory()\n"
        "    } else {",
        "    if (selectedSection === RepositorySectionTab.Changes) {\n"
        "      return this.renderContentForChanges()\n"
        "    } else if (selectedSection === RepositorySectionTab.History) {\n"
        "      return this.renderContentForHistory()\n"
        "    } else if (selectedSection === RepositorySectionTab.Commits) {\n"
        "      // The Commits tab shares the commit details/diff view with History\n"
        "      return this.renderContentForHistory()\n"
        "    } else {",
        1,
    ),
    (
        "app/src/ui/repository.tsx",
        "    if (this.focusHistoryNeeded) {\n"
        "      this.focusHistoryNeeded = false\n"
        "      this.compareSidebarRef.current?.focusHistory()\n"
        "    }\n"
        "  }",
        "    if (this.focusHistoryNeeded) {\n"
        "      this.focusHistoryNeeded = false\n"
        "      this.compareSidebarRef.current?.focusHistory()\n"
        "    }\n"
        "\n"
        "    if (this.focusCommitsNeeded) {\n"
        "      this.focusCommitsNeeded = false\n"
        "      this.commitsSidebarRef.current?.focusCommits()\n"
        "    }\n"
        "  }",
        1,
    ),
    (
        "app/src/ui/repository.tsx",
        "  private changeTab() {\n"
        "    const section =\n"
        "      this.props.state.selectedSection === RepositorySectionTab.History\n"
        "        ? RepositorySectionTab.Changes\n"
        "        : RepositorySectionTab.History",
        "  private changeTab() {\n"
        "    const { selectedSection } = this.props.state\n"
        "    const section =\n"
        "      selectedSection === RepositorySectionTab.Changes\n"
        "        ? RepositorySectionTab.History\n"
        "        : selectedSection === RepositorySectionTab.History\n"
        "          ? RepositorySectionTab.Commits\n"
        "          : RepositorySectionTab.Changes",
        1,
    ),
    (
        "app/src/ui/repository.tsx",
        "    const section =\n"
        "      tab === Tab.History\n"
        "        ? RepositorySectionTab.History\n"
        "        : RepositorySectionTab.Changes",
        "    const section =\n"
        "      tab === Tab.History\n"
        "        ? RepositorySectionTab.History\n"
        "        : tab === Tab.Commits\n"
        "          ? RepositorySectionTab.Commits\n"
        "          : RepositorySectionTab.Changes",
        1,
    ),
    # ---- G3: app-store.ts —— section 切换/刷新时处理 Commits（复用 History 刷新）----
    (
        "app/src/lib/stores/app-store.ts",
        "    if (selectedSection === RepositorySectionTab.History) {\n"
        "      await this.refreshHistorySection(repository)\n"
        "    } else if (selectedSection === RepositorySectionTab.Changes) {\n"
        "      await this.refreshChangesSection(repository, {\n"
        "        includingStatus: true,\n"
        "        clearPartialState: false,\n"
        "      })\n"
        "    }",
        "    if (selectedSection === RepositorySectionTab.History) {\n"
        "      await this.refreshHistorySection(repository)\n"
        "    } else if (selectedSection === RepositorySectionTab.Commits) {\n"
        "      await this.refreshHistorySection(repository)\n"
        "    } else if (selectedSection === RepositorySectionTab.Changes) {\n"
        "      await this.refreshChangesSection(repository, {\n"
        "        includingStatus: true,\n"
        "        clearPartialState: false,\n"
        "      })\n"
        "    }",
        1,
    ),
    (
        "app/src/lib/stores/app-store.ts",
        "    if (section === RepositorySectionTab.History) {\n"
        "      refreshSectionPromise = this.refreshHistorySection(repository)\n"
        "    } else if (section === RepositorySectionTab.Changes) {",
        "    if (section === RepositorySectionTab.History) {\n"
        "      refreshSectionPromise = this.refreshHistorySection(repository)\n"
        "    } else if (section === RepositorySectionTab.Commits) {\n"
        "      refreshSectionPromise = this.refreshHistorySection(repository)\n"
        "    } else if (section === RepositorySectionTab.Changes) {",
        1,
    ),
    # ---- G4: 样式索引引入 commits-filter ----
    (
        "app/styles/ui/_history.scss",
        "@import 'history/multiple_commits_selected';",
        "@import 'history/multiple_commits_selected';\n"
        "@import 'history/commits-filter';",
        1,
    ),
    # ---- G5: ⌘3 菜单与快捷键 ----
    (
        "app/src/models/menu-ids.ts",
        "  | 'show-changes'\n  | 'show-history'",
        "  | 'show-changes'\n  | 'show-history'\n  | 'show-commits'",
        1,
    ),
    (
        "app/src/main-process/menu/menu-event.ts",
        "  | 'show-changes'\n  | 'show-history'",
        "  | 'show-changes'\n  | 'show-history'\n  | 'show-commits'",
        1,
    ),
    (
        "app/src/main-process/menu/build-default-menu.ts",
        "      {\n"
        "        label: __DARWIN__ ? 'Show History' : '&History',\n"
        "        id: 'show-history',\n"
        "        accelerator: 'CmdOrCtrl+2',\n"
        "        click: emit('show-history'),\n"
        "      },",
        "      {\n"
        "        label: __DARWIN__ ? 'Show History' : '&History',\n"
        "        id: 'show-history',\n"
        "        accelerator: 'CmdOrCtrl+2',\n"
        "        click: emit('show-history'),\n"
        "      },\n"
        "      {\n"
        "        label: __DARWIN__ ? 'Show Commits' : 'Show Co&mmits',\n"
        "        id: 'show-commits',\n"
        "        accelerator: 'CmdOrCtrl+3',\n"
        "        click: emit('show-commits'),\n"
        "      },",
        1,
    ),
    (
        "app/src/ui/app.tsx",
        "      case 'show-history':\n        return this.showHistory(true)",
        "      case 'show-history':\n        return this.showHistory(true)\n"
        "      case 'show-commits':\n        return this.showCommits(true)",
        1,
    ),
    (
        "app/src/ui/app.tsx",
        "    if (shouldFocusHistory) {\n"
        "      this.repositoryViewRef.current?.setFocusHistoryNeeded()\n"
        "    }\n"
        "  }",
        "    if (shouldFocusHistory) {\n"
        "      this.repositoryViewRef.current?.setFocusHistoryNeeded()\n"
        "    }\n"
        "  }\n"
        "\n"
        "  private async showCommits(shouldFocusCommitList: boolean) {\n"
        "    const state = this.state.selectedState\n"
        "    if (state == null || state.type !== SelectionType.Repository) {\n"
        "      return\n"
        "    }\n"
        "\n"
        "    await this.props.dispatcher.closeCurrentFoldout()\n"
        "\n"
        "    await this.props.dispatcher.initializeCompare(state.repository, {\n"
        "      kind: HistoryTabMode.History,\n"
        "    })\n"
        "\n"
        "    await this.props.dispatcher.changeRepositorySection(\n"
        "      state.repository,\n"
        "      RepositorySectionTab.Commits\n"
        "    )\n"
        "\n"
        "    if (shouldFocusCommitList) {\n"
        "      this.repositoryViewRef.current?.setFocusCommitsNeeded()\n"
        "    }\n"
        "  }",
        1,
    ),
    # ---- G6: 品牌名（与官方版共存；cask 分发使用）----
    (
        "app/package.json",
        '  "productName": "GitHub Desktop",',
        '  "productName": "GitHub Desktop Dimple",',
        1,
    ),
    (
        "app/src/lib/menu-update.ts",
        "  'show-changes',\n  'show-history',",
        "  'show-changes',\n  'show-history',\n  'show-commits',",
        1,  # allMenuIds（2 空格缩进）
    ),
    # ---- G6: 品牌名（与官方版共存；cask 分发使用）----
    (
        "app/package.json",
        '  "productName": "GitHub Desktop",',
        '  "productName": "GitHub Desktop Dimple",',
        1,
    ),
    (
        "app/src/lib/menu-update.ts",
        "    'show-changes',\n    'show-history',",
        "    'show-changes',\n    'show-history',\n    'show-commits',",
        1,  # repositoryScopedIDs（4 空格缩进）
    ),
]


def main() -> int:
    # --fresh：先把 workspace 回退到纯上游基线（撤销已重放的补丁），再注入全部胶水。
    # 用于「修改胶水 → 重导补丁」的开发流：assemble 会重放补丁，修改胶水前需先回到基线。
    if "--fresh" in sys.argv:
        import subprocess
        subprocess.run(["git", "checkout", "--", "."], cwd=WS, check=True)
        print("[apply-glue] workspace 已回退到基线")

    planned: dict[str, list[tuple[str, str, int]]] = {}
    for rel, old, new, count in EDITS:
        if (WS / rel).read_text() is None:
            print(f"[apply-glue] 文件不存在: {rel}")
            return 1
        planned.setdefault(rel, []).append((old, new, count))

    for rel, edits in planned.items():
        text = (WS / rel).read_text()
        for old, new, count in edits:
            found = text.count(old)
            if found != count:
                print(f"[apply-glue] 锚点匹配数 {found} ≠ 期望 {count}: {rel}\n---\n{old[:200]}\n---")
                return 1
        for old, new, count in edits:
            text = text.replace(old, new)
        (WS / rel).write_text(text)
        print(f"[apply-glue] 已应用 {len(edits)} 处改动 → {rel}")

    print("[apply-glue] 全部胶水改动应用成功")
    return 0


if __name__ == "__main__":
    sys.exit(main())
