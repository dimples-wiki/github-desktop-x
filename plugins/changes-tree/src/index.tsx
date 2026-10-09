import { React } from "./ghd";
import {
  Popover,
  PopoverAnchorPosition,
  PopoverDecoration,
  CheckboxValue,
  DiffSelectionType,
  octicons,
  registerChangesFileView,
} from "./ghd";

const { Checkbox, ChangedFile, TextBox, Octicon, Button } = (globalThis as any)
  .__GHD_EXTENSION_API__.components;

/**
 * The "Tree" changes file view: renders the working directory changes as a
 * collapsible folder hierarchy.
 *
 * Feature parity with the built-in flat list:
 *  - the same filter row: status filter popover (included/excluded/new/
 *    modified/deleted, with counts) + text filter + the List/Tree switch
 *  - tri-state "include all" header with the changed files count
 *  - leaf rows reuse the host's `ChangedFile` component (include checkbox,
 *    right-hand status badge)
 *
 * The host context menu for file rows is bridged via onFileContextMenu.
 */

interface ITreeNode {
  readonly name: string;
  readonly path: string;
  readonly children: Map<string, ITreeNode>;
  file?: any;
}

interface IStatusFilters {
  readonly isIncludedInCommit: boolean;
  readonly isExcludedFromCommit: boolean;
  readonly isNewFile: boolean;
  readonly isModifiedFile: boolean;
  readonly isDeletedFile: boolean;
}

const NoStatusFilters: IStatusFilters = {
  isIncludedInCommit: false,
  isExcludedFromCommit: false,
  isNewFile: false,
  isModifiedFile: false,
  isDeletedFile: false,
};

function buildTree(files: ReadonlyArray<any>): Map<string, ITreeNode> {
  const root = new Map<string, ITreeNode>();

  for (const file of files) {
    const segments = file.path.split("/");
    let level = root;
    let prefix = "";

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      prefix = prefix.length === 0 ? segment : `${prefix}/${segment}`;
      const isLeaf = i === segments.length - 1;

      let node = level.get(segment);
      if (node === undefined) {
        node = {
          name: segment,
          path: prefix,
          children: new Map(),
          file: isLeaf ? file : undefined,
        };
        level.set(segment, node);
      } else if (isLeaf) {
        node.file = file;
      }

      level = node.children;
    }
  }

  return root;
}

function isIncluded(file: any): boolean {
  return file.selection.getSelectionType() === DiffSelectionType.All;
}

function statusKindOf(file: any): string {
  return String(file?.status?.kind ?? "");
}

/** Mirrors the host's applyFilterOptions: active filters exclude non-matches. */
function matchesStatusFilters(file: any, filters: IStatusFilters): boolean {
  const active = Object.values(filters);
  if (!active.some(Boolean)) {
    return true;
  }

  if (filters.isIncludedInCommit && !isIncluded(file)) {
    return false;
  }
  if (filters.isExcludedFromCommit && isIncluded(file)) {
    return false;
  }
  if (
    filters.isNewFile &&
    statusKindOf(file) !== "New" &&
    statusKindOf(file) !== "Untracked"
  ) {
    return false;
  }
  if (filters.isModifiedFile && statusKindOf(file) !== "Modified") {
    return false;
  }
  if (filters.isDeletedFile && statusKindOf(file) !== "Deleted") {
    return false;
  }

  return true;
}

const treeCss = `
.changes-tree {
  flex: 1;
  overflow-y: auto;
  user-select: none;
}

/* The filter row and the include-all header reuse the native
   .header.filter-field-row classes, so every host style
   (.changes-list-container .header ...) applies unchanged and both
   views stay pixel-identical. The one rule the native cascade carries
   in a scope the tree does not share (.filter-list ...) is repeated
   here: the filter field must be shrinkable, or narrow sidebars
   overflow and push the view switch against the panel edge. */
.changes-tree .filter-field-row .filter-list-filter-field {
  min-width: 0;
}

.changes-tree-row {
  display: flex;
  align-items: center;
  height: 29px;
  cursor: default;
}

.changes-tree-row.folder {
  padding-right: var(--spacing);
}

.changes-tree-row .tree-caret {
  width: 16px;
  height: 16px;
  flex: initial;
  margin-right: 2px;
  fill: var(--text-secondary-color);
}

.changes-tree-row .tree-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--font-size);
  color: var(--text-secondary-color);
}

.changes-tree-row .tree-count {
  margin-left: auto;
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
}
`;

function styleInjection() {
  return <style>{treeCss}</style>;
}

interface ITreeRow {
  readonly depth: number;
  readonly name: string;
  readonly path: string;
  readonly file?: any;
  readonly descendantCount: number;
}

function flattenTree(
  nodes: Map<string, ITreeNode>,
  collapsed: ReadonlySet<string>,
  depth: number,
  out: ITreeRow[],
) {
  const sorted = [...nodes.values()].sort((a, b) => {
    const aDir = a.file === undefined ? 0 : 1;
    const bDir = b.file === undefined ? 0 : 1;
    if (aDir !== bDir) {
      return aDir - bDir;
    }
    return a.name.localeCompare(b.name);
  });

  for (const node of sorted) {
    const isFolder = node.file === undefined;
    const descendantCount = isFolder ? countFiles(node) : 0;
    out.push({
      depth,
      name: node.name,
      path: node.path,
      file: node.file,
      descendantCount,
    });

    if (isFolder && !collapsed.has(node.path)) {
      flattenTree(node.children, collapsed, depth + 1, out);
    }
  }
}

function countFiles(node: ITreeNode): number {
  let total = node.file !== undefined ? 1 : 0;
  for (const child of node.children.values()) {
    total += countFiles(child);
  }
  return total;
}

interface IStatusCounts {
  readonly included: number;
  readonly excluded: number;
  readonly newFiles: number;
  readonly modifiedFiles: number;
  readonly deletedFiles: number;
}

function countStatuses(files: ReadonlyArray<any>): IStatusCounts {
  let included = 0;
  let excluded = 0;
  let newFiles = 0;
  let modifiedFiles = 0;
  let deletedFiles = 0;

  for (const file of files) {
    if (isIncluded(file)) {
      included++;
    } else {
      excluded++;
    }

    const kind = statusKindOf(file);
    if (kind === "New" || kind === "Untracked") {
      newFiles++;
    } else if (kind === "Modified") {
      modifiedFiles++;
    } else if (kind === "Deleted") {
      deletedFiles++;
    }
  }

  return { included, excluded, newFiles, modifiedFiles, deletedFiles };
}

function TreeCaret(props: { expanded: boolean }) {
  // Minimal inline caret (keeps the plugin free of octicon imports).
  const path = props.expanded
    ? "M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z"
    : "M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z";

  return (
    <svg
      className={`tree-caret${props.expanded ? " expanded" : ""}`}
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

/** Tree view state that survives tab switches, scoped per repository
 *  (the section unmounts on tab change; the native Changes filter state
 *  lives in the store and persists the same way). */
interface IPersistedTreeViewState {
  collapsedFolders: Set<string>;
  filterText: string;
  statusFilters: IStatusFilters;
}
let persistedTreeState: IPersistedTreeViewState | null = null;
let persistedTreeRepoId: any = undefined;

export class ChangesTreeView extends React.Component<any, any> {
  private filterButtonRef: any = null;

  public constructor(props: any) {
    super(props);

    const repoId = props.repository?.id;
    if (
      persistedTreeState === null ||
      persistedTreeRepoId !== repoId
    ) {
      persistedTreeRepoId = repoId;
      persistedTreeState = {
        collapsedFolders: new Set<string>(),
        filterText: "",
        statusFilters: NoStatusFilters,
      };
    }

    this.state = {
      collapsedFolders: persistedTreeState.collapsedFolders,
      filterText: persistedTreeState.filterText,
      statusFilters: persistedTreeState.statusFilters,
      isFilterOptionsOpen: false,
      focusWithin: false,
    };
  }

  /** Persists the persistable slice after every relevant update. */
  private persistState(state: any) {
    persistedTreeState = {
      collapsedFolders: state.collapsedFolders,
      filterText: state.filterText,
      statusFilters: state.statusFilters,
    };
  }

  // Mirrors the host's FocusContainer: selected rows must use the
  // active (--box-selected-active-*) palette while the list holds
  // keyboard focus, exactly like the built-in list.
  private onFocusWithinChanged = (focusWithin: boolean) => {
    this.setState({ focusWithin: focusWithin });
  };

  private toggleFolder = (path: string) => {
    this.setState((prevState: any) => {
      const collapsedFolders = new Set(prevState.collapsedFolders);
      if (collapsedFolders.has(path)) {
        collapsedFolders.delete(path);
      } else {
        collapsedFolders.add(path);
      }
      const next = { collapsedFolders };
      this.persistState({ ...prevState, ...next });
      return next;
    });
  };

  private onFilterTextChanged = (value: string) => {
    this.setState((prevState: any) => {
      const next = { filterText: value };
      this.persistState({ ...prevState, ...next });
      return next;
    });
  };

  private toggleFilterOptionsOpen = () => {
    this.setState((prevState: any) => ({
      isFilterOptionsOpen: !prevState.isFilterOptionsOpen,
    }));
  };

  private closeFilterOptions = () => {
    this.setState({ isFilterOptionsOpen: false });
  };

  // Same pattern as the host's ChangesListFilterOptions: semantic toggle,
  // no event reads (currentTarget is null inside the popover portal on
  // React 16). Native also closes the popover after each toggle.
  private onStatusFilterChanged = (key: string) => () => {
    this.setState((prevState: any) => {
      const next = {
        statusFilters: {
          ...prevState.statusFilters,
          [key]: !prevState.statusFilters[key],
        },
        isFilterOptionsOpen: false,
      };
      this.persistState({ ...prevState, ...next });
      return next;
    });
  };

  private clearStatusFilters = () => {
    this.setState((prevState: any) => {
      const next = {
        statusFilters: NoStatusFilters,
        isFilterOptionsOpen: false,
      };
      this.persistState({ ...prevState, ...next });
      return next;
    });
  };

  private renderFilterPopover(files: ReadonlyArray<any>) {
    const filters: IStatusFilters = this.state.statusFilters;
    const counts = countStatuses(files);
    const activeCount = Object.values(filters).filter(Boolean).length;

    const checkboxRow = (key: string, label: string, count: number) => (
      <Checkbox
        key={key}
        value={filters[key] ? CheckboxValue.On : CheckboxValue.Off}
        onChange={this.onStatusFilterChanged(key)}
        label={`${label} (${count})`}
      />
    );

    return (
      <Popover
        className="filter-popover"
        ariaLabelledby="changes-tree-filter-header"
        anchor={this.filterButtonRef}
        anchorPosition={PopoverAnchorPosition.BottomRight}
        decoration={PopoverDecoration.Balloon}
        onMousedownOutside={this.closeFilterOptions}
        onClickOutside={this.closeFilterOptions}
      >
        <div className="filter-popover-header">
          <h3 id="changes-tree-filter-header">Filter Options</h3>
          <button
            className="close"
            onClick={this.closeFilterOptions}
            aria-label="Close"
          >
            <Octicon symbol={octicons.x} />
          </button>
        </div>
        <div className="filter-options">
          {checkboxRow(
            "isIncludedInCommit",
            "Included in commit",
            counts.included,
          )}
          {checkboxRow(
            "isExcludedFromCommit",
            "Excluded from commit",
            counts.excluded,
          )}
          {checkboxRow("isNewFile", "New files", counts.newFiles)}
          {checkboxRow(
            "isModifiedFile",
            "Modified files",
            counts.modifiedFiles,
          )}
          {checkboxRow("isDeletedFile", "Deleted files", counts.deletedFiles)}
        </div>
        {activeCount > 0 ? (
          <div className="filter-options-footer">
            <Button onClick={this.clearStatusFilters}>Clear filters</Button>
          </div>
        ) : null}
      </Popover>
    );
  }

  public render() {
    const {
      files,
      availableWidth,
      includeAllValue,
      onIncludeAllChanged,
      selectedFiles,
    } = this.props;
    const filterText = this.state.filterText.trim().toLowerCase();
    const statusFilters: IStatusFilters = this.state.statusFilters;

    const visibleFiles = files.filter((file) => {
      if (
        filterText.length > 0 &&
        !file.path.toLowerCase().includes(filterText)
      ) {
        return false;
      }
      return matchesStatusFilters(file, statusFilters);
    });

    const tree = buildTree(visibleFiles);

    const rows: ITreeRow[] = [];
    flattenTree(tree, this.state.collapsedFolders, 0, rows);

    const activeCount = Object.values(statusFilters).filter(Boolean).length;

    // The slot passes the host's IChangesListItem records ({ id, change }),
    // where `change` is the working-directory file — accept both shapes.
    const selectedKeys = new Set<string>();
    for (const f of selectedFiles ?? []) {
      if (f?.change?.path !== undefined) {
        selectedKeys.add(String(f.change.path));
      }
      if (f?.path !== undefined) {
        selectedKeys.add(String(f.path));
      }
    }

    // Mirrors the host's check-all label: "N of M changed files" while
    // filters hide part of the list.
    const checkAllLabel =
      visibleFiles.length !== files.length
        ? `${visibleFiles.length} of ${files.length} changed files`
        : `${files.length} changed file${files.length === 1 ? "" : "s"}`;

    return (
      <div className="file-list">
        <div
          className={`list-focus-container${
            this.state.focusWithin ? " focus-within" : ""
          }`}
          onFocus={() => this.onFocusWithinChanged(true)}
          onBlur={() => this.onFocusWithinChanged(false)}
        >
          <div className="changes-tree">
            {styleInjection()}

            {/* Same classes as the built-in list's filter row so every
                host style (.changes-list-container .header ...) applies. */}
            <div className="header filter-field-row">
              <div className="filter-box-container">
                <span>
                  <button
                    className={`button-component filter-button${
                      activeCount > 0 ? " active" : ""
                    }`}
                    onClick={this.toggleFilterOptionsOpen}
                    aria-expanded={this.state.isFilterOptionsOpen}
                    ref={(ref: any) => (this.filterButtonRef = ref)}
                    title="Filter Options"
                    aria-label="Filter Options"
                  >
                    <span>
                      <Octicon symbol={octicons.filter} />
                    </span>
                    {activeCount > 0 ? (
                      <span className="active-badge">
                        <div className="badge-bg">
                          <div className="badge"></div>
                        </div>
                      </span>
                    ) : null}
                    <Octicon symbol={octicons.triangleDown} />
                  </button>

                  {this.state.isFilterOptionsOpen
                    ? this.renderFilterPopover(files)
                    : null}
                </span>

                <TextBox
                  value={this.state.filterText}
                  placeholder={"Filter"}
                  className="filter-list-filter-field"
                  displayClearButton={true}
                  onValueChanged={this.onFilterTextChanged}
                />

                {this.props.viewSwitch}
              </div>

              <div className="checkbox-container">
                <Checkbox
                  value={includeAllValue}
                  onChange={(event: any) => {
                    const source = event?.currentTarget ?? event?.target;
                    onIncludeAllChanged(
                      source?.checked ??
                        !(includeAllValue === CheckboxValue.On),
                    );
                  }}
                  className="changes-list-check-all"
                  label={checkAllLabel}
                />
              </div>
            </div>

            {rows.map((row) => {
              const isFolder = row.file === undefined;
              const include =
                !isFolder &&
                row.file.selection.getSelectionType() === DiffSelectionType.All;
              const selected =
                !isFolder && selectedKeys.has(String(row.file.path));

              return (
                <div
                  key={row.path}
                  className={`changes-tree-row list-item${
                    isFolder ? " folder" : ""
                  }${include ? " included" : ""}${selected ? " selected" : ""}`}
                  style={{
                    paddingLeft: isFolder
                      ? 10 + row.depth * 14
                      : row.depth * 14,
                  }}
                  tabIndex={-1}
                  onClick={(event: any) => {
                    // Like the built-in list: the clicked row takes
                    // keyboard focus, driving the focus-within palette.
                    event.currentTarget.focus();
                    if (isFolder) {
                      this.toggleFolder(row.path);
                    } else {
                      this.props.onSelectionChanged([row.file]);
                    }
                  }}
                  onContextMenu={
                    isFolder
                      ? undefined
                      : (event: any) => {
                          event.preventDefault();
                          this.props.onFileContextMenu(row.file, event);
                        }
                  }
                  title={row.path}
                >
                  {isFolder ? (
                    <TreeCaret
                      expanded={!this.state.collapsedFolders.has(row.path)}
                    />
                  ) : null}

                  {isFolder ? (
                    <span className="tree-name">{row.name}</span>
                  ) : (
                    <ChangedFile
                      file={{ ...row.file, path: row.name }}
                      include={include}
                      availableWidth={Math.max(
                        140,
                        (availableWidth ?? 340) - row.depth * 14,
                      )}
                      disableSelection={false}
                      focused={false}
                      onIncludeChanged={(f, inc) =>
                        this.props.onIncludeChanged(row.file, inc)
                      }
                    />
                  )}

                  {isFolder ? (
                    <span className="tree-count">{row.descendantCount}</span>
                  ) : null}
                </div>
              );
            })}

            {rows.length === 0 ? (
              <div className="no-changes-filtered">
                <div className="title">No files match your current filters</div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }
}

// Registered after the component declaration (class declarations are not
// hoisted). Reads the API from globalThis to avoid esbuild import elision.
(globalThis as any).__GHD_EXTENSION_API__.registerChangesFileView({
  id: "changes-tree",
  title: "Tree",
  component: ChangesTreeView,
});
