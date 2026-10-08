#!/usr/bin/env python3
"""在 workspace 中应用「插件框架接线」胶水改动（v2：运行时动态插件）。

上游侧的改动全部是**通用**的扩展点接线（不包含任何 Commits/Tree 业务逻辑）：
  - RepositorySectionTab 枚举提供 ExtensionStart 基值
  - repository.tsx 动态渲染/路由/聚焦扩展 tab；挂载时初始化插件加载器并订阅注册表
  - app-store.ts 按扩展声明的刷新语义处理 section 切换/刷新
  - filter-changes-list.tsx 提供 ChangesFileViewSlot 插槽（插件可替换文件列表）
  - build-default-menu.ts / menu-ids / menu-event / app.tsx 由插件清单驱动菜单
  - main.ts 启动插件宿主（扫描 plugins 目录、下发插件包、重建菜单）

插件本体在运行时由 main-process/extensions/plugin-host 动态加载（见 plugins/）。

每个锚点(old)必须恰好出现期望次数，否则中止且不落盘。
`--fresh` 先把 workspace 回退到基线（撤销已重放的补丁）再注入。
"""
import sys
from pathlib import Path

WS = Path(__file__).resolve().parent.parent / "workspace"

EDITS = [
    # ---- F1: RepositorySectionTab 提供 ExtensionStart 基值 ----
    (
        "app/src/lib/app-state.ts",
        "export enum RepositorySectionTab {\n  Changes,\n  History,\n}",
        "export enum RepositorySectionTab {\n  Changes,\n  History,\n"
        "  /**\n"
        "   * Base value for dynamically assigned repository section extensions\n"
        "   * (see lib/extensions/extension-points).\n"
        "   */\n"
        "  ExtensionStart = 1000,\n"
        "}",
        1,
    ),
    # ---- F2: repository.tsx ----
    (
        "app/src/ui/repository.tsx",
        "import { SelectedCommits, CompareSidebar } from './history'",
        "import { SelectedCommits, CompareSidebar } from './history'\n"
        "import {\n"
        "  getExtensionForSection,\n"
        "  getRepositorySectionExtensions,\n"
        "  getSectionForExtension,\n"
        "  getTabIdForExtension,\n"
        "  sectionForExtensionIndex,\n"
        "  subscribeRepositorySectionExtensions,\n"
        "} from '../lib/extensions/extension-points'\n"
        "import { initializeExtensionLoader } from '../lib/extensions/plugin-loader'",
        1,
    ),
    (
        "app/src/ui/repository.tsx",
        "const enum Tab {\n  Changes = 0,\n  History = 1,\n}",
        "const enum Tab {\n  Changes = 0,\n  History = 1,\n}\n"
        "\n"
        "// Extension tabs are rendered after the built-in ones; their tab value\n"
        "// is ExtensionTabBase + index into the extension registry.\n"
        "const ExtensionTabBase = 2",
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
        "  private readonly extensionSidebarRefs = new Map<\n"
        "    string,\n"
        "    React.RefObject<any>\n"
        "  >()\n"
        "\n"
        "  private focusHistoryNeeded: boolean = false\n"
        "  private focusChangesNeeded: boolean = false\n"
        "  private focusExtensionId: string | null = null\n"
        "  private disposeExtensionSubscription: (() => void) | null = null",
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
        "  public setFocusExtensionNeeded(id: string): void {\n"
        "    this.focusExtensionId = id\n"
        "  }\n"
        "\n"
        "  private getExtensionSidebarRef(id: string) {\n"
        "    let ref = this.extensionSidebarRefs.get(id)\n"
        "\n"
        "    if (ref === undefined) {\n"
        "      ref = React.createRef<any>()\n"
        "      this.extensionSidebarRefs.set(id, ref)\n"
        "    }\n"
        "\n"
        "    return ref\n"
        "  }",
        1,
    ),
    (
        "app/src/ui/repository.tsx",
        "    const selectedTab =\n"
        "      this.props.state.selectedSection === RepositorySectionTab.Changes\n"
        "        ? Tab.Changes\n"
        "        : Tab.History",
        "    const extensions = getRepositorySectionExtensions()\n"
        "    const selectedTab =\n"
        "      this.props.state.selectedSection === RepositorySectionTab.Changes\n"
        "        ? Tab.Changes\n"
        "        : this.props.state.selectedSection === RepositorySectionTab.History\n"
        "          ? Tab.History\n"
        "          : ExtensionTabBase +\n"
        "            extensions.findIndex(\n"
        "              e =>\n"
        "                getSectionForExtension(e) === this.props.state.selectedSection\n"
        "            )",
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
        "        {extensions.map(extension => (\n"
        "          <div\n"
        "            key={extension.id}\n"
        "            className=\"with-indicator\"\n"
        "            id={getTabIdForExtension(extension)}\n"
        "          >\n"
        "            <span>{extension.title}</span>\n"
        "          </div>\n"
        "        ))}\n"
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
        "  private renderExtensionSidebar(): JSX.Element {\n"
        "    const section = this.props.state.selectedSection\n"
        "    const extension = getExtensionForSection(section)\n"
        "\n"
        "    if (extension === undefined) {\n"
        "      throw new Error(`Unknown repository section: ${section}`)\n"
        "    }\n"
        "\n"
        "    const Sidebar = extension.sidebarComponent\n"
        "\n"
        "    return (\n"
        "      <Sidebar\n"
        "        ref={this.getExtensionSidebarRef(extension.id)}\n"
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
        "    } else if (selectedSection === RepositorySectionTab.History) {\n"
        "      return this.renderCompareSidebar()\n"
        "    } else {",
        "    } else if (selectedSection === RepositorySectionTab.History) {\n"
        "      return this.renderCompareSidebar()\n"
        "    } else if (getExtensionForSection(selectedSection) !== undefined) {\n"
        "      return this.renderExtensionSidebar()\n"
        "    } else {",
        1,
    ),
    (
        "app/src/ui/repository.tsx",
        "    } else if (selectedSection === RepositorySectionTab.History) {\n"
        "      return this.renderContentForHistory()\n"
        "    } else {",
        "    } else if (selectedSection === RepositorySectionTab.History) {\n"
        "      return this.renderContentForHistory()\n"
        "    } else if (getExtensionForSection(selectedSection) !== undefined) {\n"
        "      // Extension sections share the commit details/diff view with History\n"
        "      return this.renderContentForHistory()\n"
        "    } else {",
        1,
    ),
    (
        "app/src/ui/repository.tsx",
        "  public componentDidMount() {\n"
        "    window.addEventListener('keydown', this.onGlobalKeyDown)\n"
        "  }\n"
        "\n"
        "  public componentWillUnmount() {\n"
        "    window.removeEventListener('keydown', this.onGlobalKeyDown)\n"
        "  }",
        "  public componentDidMount() {\n"
        "    window.addEventListener('keydown', this.onGlobalKeyDown)\n"
        "\n"
        "    // Runtime repository section extensions (see lib/extensions) may be\n"
        "    // installed while the app is running; re-render the tab bar on change\n"
        "    // and arm the plugin loader.\n"
        "    this.disposeExtensionSubscription = subscribeRepositorySectionExtensions(\n"
        "      () => this.forceUpdate()\n"
        "    )\n"
        "    initializeExtensionLoader()\n"
        "  }\n"
        "\n"
        "  public componentWillUnmount() {\n"
        "    window.removeEventListener('keydown', this.onGlobalKeyDown)\n"
        "\n"
        "    if (this.disposeExtensionSubscription !== null) {\n"
        "      this.disposeExtensionSubscription()\n"
        "      this.disposeExtensionSubscription = null\n"
        "    }\n"
        "  }",
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
        "    if (this.focusExtensionId !== null) {\n"
        "      const id = this.focusExtensionId\n"
        "      this.focusExtensionId = null\n"
        "      this.extensionSidebarRefs.get(id)?.current?.focus()\n"
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
        "    const extensions = getRepositorySectionExtensions()\n"
        "    let section: RepositorySectionTab\n"
        "\n"
        "    if (selectedSection === RepositorySectionTab.Changes) {\n"
        "      section = RepositorySectionTab.History\n"
        "    } else if (\n"
        "      selectedSection === RepositorySectionTab.History &&\n"
        "      extensions.length > 0\n"
        "    ) {\n"
        "      section = getSectionForExtension(extensions[0])\n"
        "    } else {\n"
        "      section = RepositorySectionTab.Changes\n"
        "    }",
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
        "        : tab >= ExtensionTabBase\n"
        "          ? sectionForExtensionIndex(tab - ExtensionTabBase)\n"
        "          : RepositorySectionTab.Changes",
        1,
    ),
    (
        "app/src/ui/repository.tsx",
        "      return assertNever(selectedSection, 'Unknown repository section')",
        "      throw new Error(`Unknown repository section: ${selectedSection}`)",
        2,
    ),
    (
        "app/src/ui/repository.tsx",
        "import { assertNever } from '../lib/fatal-error'\n",
        "",
        1,
    ),
    # ---- F3: app-store.ts ----
    (
        "app/src/lib/stores/app-store.ts",
        "import { getConflictResolutionModelDisplay } from '../copilot/conflict-resolution-model'",
        "import { getConflictResolutionModelDisplay } from '../copilot/conflict-resolution-model'\n"
        "import { getExtensionForSection } from '../extensions/extension-points'",
        1,
    ),
    (
        "app/src/lib/stores/app-store.ts",
        "    if (selectedSection === RepositorySectionTab.History) {\n"
        "      await this.refreshHistorySection(repository)\n"
        "    } else if (selectedSection === RepositorySectionTab.Changes) {",
        "    if (selectedSection === RepositorySectionTab.History) {\n"
        "      await this.refreshHistorySection(repository)\n"
        "    } else if (\n"
        "      getExtensionForSection(selectedSection)?.refreshOnActivate ===\n"
        "      'history'\n"
        "    ) {\n"
        "      await this.refreshHistorySection(repository)\n"
        "    } else if (selectedSection === RepositorySectionTab.Changes) {",
        1,
    ),
    (
        "app/src/lib/stores/app-store.ts",
        "    if (section === RepositorySectionTab.History) {\n"
        "      refreshSectionPromise = this.refreshHistorySection(repository)\n"
        "    } else if (section === RepositorySectionTab.Changes) {",
        "    if (section === RepositorySectionTab.History) {\n"
        "      refreshSectionPromise = this.refreshHistorySection(repository)\n"
        "    } else if (\n"
        "      getExtensionForSection(section)?.refreshOnActivate === 'history'\n"
        "    ) {\n"
        "      refreshSectionPromise = this.refreshHistorySection(repository)\n"
        "    } else if (section === RepositorySectionTab.Changes) {",
        1,
    ),
    (
        "app/src/lib/stores/app-store.ts",
        "      return assertNever(section, `Unknown section: ${section}`)",
        "      throw new Error(`Unknown section: ${section}`)",
        1,
    ),
    # ---- F4: changes 文件列表插槽（插件可替换为树形视图等）----
    (
        "app/src/ui/changes/filter-changes-list.tsx",
        "import { ChangesListFilterOptions } from './changes-list-filter-options'",
        "import { ChangesListFilterOptions } from './changes-list-filter-options'\n"
        "import { ChangesFileViewSlot } from '../../lib/extensions/changes-file-view-slot'\n"
        "import { ChangesFileViewSwitch } from '../../lib/extensions/changes-file-view-switch'\n"
        "import { FileChange } from '../../models/status'",
        1,
    ),
    (
        "app/src/ui/changes/filter-changes-list.tsx",
        "  private onFileSelectionChanged = (items: ReadonlyArray<IChangesListItem>) => {\n"
        "    const rows = items.map(i =>\n"
        "      this.props.workingDirectory.findFileIndexByID(i.change.id)\n"
        "    )\n"
        "    this.props.onFileSelectionChanged(rows)\n"
        "  }",
        "  private onFileSelectionChanged = (items: ReadonlyArray<IChangesListItem>) => {\n"
        "    const rows = items.map(i =>\n"
        "      this.props.workingDirectory.findFileIndexByID(i.change.id)\n"
        "    )\n"
        "    this.props.onFileSelectionChanged(rows)\n"
        "  }\n"
        "\n"
        "  /** Context menu bridge for the plugin-provided changes file view. */\n"
        "  private onChangesFileViewContextMenu = (\n"
        "    file: WorkingDirectoryFileChange,\n"
        "    event: React.MouseEvent<HTMLDivElement>\n"
        "  ) => {\n"
        "    if (this.props.isCommitting) {\n"
        "      return\n"
        "    }\n"
        "\n"
        "    event.preventDefault()\n"
        "    const items =\n"
        "      this.props.rebaseConflictState === null\n"
        "        ? this.getDefaultContextMenu(file)\n"
        "        : this.getRebaseContextMenu(file)\n"
        "\n"
        "    showContextualMenu(items)\n"
        "  }\n"
        "\n"
        "  /** Selection bridge for the plugin-provided changes file view. */\n"
        "  private onChangesFileViewSelectionChanged = (\n"
        "    files: ReadonlyArray<FileChange>\n"
        "  ) => {\n"
        "    const rows = files.map(f =>\n"
        "      this.props.workingDirectory.findFileIndexByID(f.id)\n"
        "    )\n"
        "    this.props.onFileSelectionChanged(rows)\n"
        "  }",
        1,
    ),
    (
        "app/src/ui/changes/filter-changes-list.tsx",
        "        <div className=\"changes-list-container file-list filtered-changes-list\">\n"
        "          <AugmentedSectionFilterList<IChangesListItem>",
        "        <div className=\"changes-list-container file-list filtered-changes-list\">\n"
        "          <ChangesFileViewSlot\n"
        "            files={workingDirectory.files}\n"
        "            onSelectionChanged={this.onChangesFileViewSelectionChanged}\n"
        "            onIncludeChanged={this.props.onIncludeChanged}\n"
        "            includeAllValue={getCheckBoxValueFromIncludeAll(\n"
        "              workingDirectory.includeAll\n"
        "            )}\n"
        "            onIncludeAllChanged={include =>\n"
        "              this.props.onIncludeChanged(\n"
        "                workingDirectory.files,\n"
        "                include\n"
        "              )\n"
        "            }\n"
        "            availableWidth={this.props.availableWidth}\n"
        "            onFileContextMenu={this.onChangesFileViewContextMenu}\n"
        "            fallback={\n"
        "          <AugmentedSectionFilterList<IChangesListItem>",
        1,
    ),
    (
        "app/src/ui/changes/filter-changes-list.tsx",
        "            postNoResultsMessage={getNoResultsMessage(\n"
        "              this.props.fileListFilter\n"
        "            )}\n"
        "          />\n"
        "        </div>",
        "            postNoResultsMessage={getNoResultsMessage(\n"
        "              this.props.fileListFilter\n"
        "            )}\n"
        "            />\n"
        "          }\n"
        "        />\n"
        "        </div>",
        1,
    ),
    (
        "app/src/ui/changes/filter-changes-list.tsx",
        "          value={this.props.fileListFilter.filterText}\n"
        "        />\n"
        "      </div>",
        "          value={this.props.fileListFilter.filterText}\n"
        "        />\n"
        "          {/* List/Tree icon switch for plugin-provided file views */}\n"
        "          <ChangesFileViewSwitch />\n"
        "      </div>",
        1,
    ),
    # ---- F6: 菜单/快捷键由插件清单驱动 ----
    (
        "app/src/models/menu-ids.ts",
        "  | 'show-changes'\n  | 'show-history'",
        "  | 'show-changes'\n  | 'show-history'\n  | `show-extension-${string}`",
        1,
    ),
    (
        "app/src/main-process/menu/menu-event.ts",
        "  | 'show-changes'\n  | 'show-history'",
        "  | 'show-changes'\n  | 'show-history'\n  | `show-extension-${string}`",
        1,
    ),
    (
        "app/src/main-process/menu/build-default-menu.ts",
        "import { buildTestMenu } from './build-test-menu'",
        "import { buildTestMenu } from './build-test-menu'\n"
        "import { getExtensionMenuItems } from '../../lib/extensions/extension-manifests'",
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
        "      // Menu items contributed by repository section extensions\n"
        "      // (see lib/extensions).\n"
        "      ...getExtensionMenuItems().map(item => ({\n"
        "        label: __DARWIN__\n"
        "          ? item.label\n"
        "          : item.label.replace('Show ', 'Show &'),\n"
        "        id: item.id,\n"
        "        accelerator: item.accelerator,\n"
        "        click: emit(item.id as MenuEvent),\n"
        "      })),",
        1,
    ),
    (
        "app/src/ui/app.tsx",
        "import { MenuEvent, isTestMenuEvent } from '../main-process/menu'",
        "import { MenuEvent, isTestMenuEvent } from '../main-process/menu'\n"
        "import {\n"
        "  getRepositorySectionExtensionById,\n"
        "  getSectionForExtension,\n"
        "} from '../lib/extensions/extension-points'",
        1,
    ),
    (
        "app/src/ui/app.tsx",
        "  private onMenuEvent(name: MenuEvent): any {\n"
        "    // Don't react to menu events when an error dialog is shown.\n"
        "    if (name !== 'test-app-error' && this.state.errorCount > 1) {\n"
        "      return\n"
        "    }",
        "  private onMenuEvent(name: MenuEvent): any {\n"
        "    // Don't react to menu events when an error dialog is shown.\n"
        "    if (name !== 'test-app-error' && this.state.errorCount > 1) {\n"
        "      return\n"
        "    }\n"
        "\n"
        "    if (name.startsWith('show-extension-')) {\n"
        "      return this.showExtension(name.slice('show-extension-'.length))\n"
        "    }",
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
        "  private async showExtension(extensionId: string) {\n"
        "    const state = this.state.selectedState\n"
        "    if (state == null || state.type !== SelectionType.Repository) {\n"
        "      return\n"
        "    }\n"
        "\n"
        "    const extension = getRepositorySectionExtensionById(extensionId)\n"
        "    if (extension === undefined) {\n"
        "      return\n"
        "    }\n"
        "\n"
        "    await this.props.dispatcher.closeCurrentFoldout()\n"
        "\n"
        "    if (extension.refreshOnActivate === 'history') {\n"
        "      await this.props.dispatcher.initializeCompare(state.repository, {\n"
        "        kind: HistoryTabMode.History,\n"
        "      })\n"
        "    }\n"
        "\n"
        "    await this.props.dispatcher.changeRepositorySection(\n"
        "      state.repository,\n"
        "      getSectionForExtension(extension)\n"
        "    )\n"
        "\n"
        "    this.repositoryViewRef.current?.setFocusExtensionNeeded(extension.id)\n"
        "  }",
        1,
    ),
    (
        "app/src/ui/app.tsx",
        "        return assertNever(name, `Unknown menu event name: ${name}`)",
        "        throw new Error(`Unknown menu event name: ${name}`)",
        1,
    ),
    # ---- F7: main.ts 启动插件宿主 ----
    (
        "app/src/main-process/main.ts",
        "import { buildDefaultMenu, getAllMenuItems } from './menu'",
        "import { buildDefaultMenu, getAllMenuItems } from './menu'\n"
        "import { initializeExtensionHost } from './extensions/plugin-host'",
        1,
    ),
    (
        "app/src/main-process/main.ts",
        "  Menu.setApplicationMenu(\n"
        "    buildDefaultMenu({\n"
        "      selectedShell: null,",
        "  // Discover installed plugins before the menu is built so their items\n"
        "  // are part of the initial template.\n"
        "  initializeExtensionHost()\n"
        "\n"
        "  Menu.setApplicationMenu(\n"
        "    buildDefaultMenu({\n"
        "      selectedShell: null,",
        1,
    ),
    # ---- F8: 品牌名 ----
    (
        "app/package.json",
        '  "productName": "GitHub Desktop",',
        '  "productName": "GitHub Desktop Dimple",',
        1,
    ),
]


def main() -> int:
    if "--fresh" in sys.argv:
        import subprocess
        # reset --hard 才能回到 HEAD（基线）；checkout -- . 只恢复到暂存区，
        # 而 export-patches.sh 会把胶水 add 进暂存区。
        subprocess.run(["git", "reset", "--hard", "HEAD"], cwd=WS, check=True)
        print("[apply-glue] workspace 已回退到基线")

    planned: dict[str, list[tuple[str, str, int]]] = {}
    for rel, old, new, count in EDITS:
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

    print("[apply-glue] 全部框架接线应用成功")
    return 0


if __name__ == "__main__":
    sys.exit(main())
