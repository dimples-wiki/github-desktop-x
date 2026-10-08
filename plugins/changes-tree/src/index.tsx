import { React } from './ghd'
import {
  Popover,
  PopoverAnchorPosition,
  PopoverDecoration,
  CheckboxValue,
  DiffSelectionType,
  octicons,
  registerChangesFileView,
} from './ghd'

const { Checkbox, ChangedFile, TextBox, Octicon, Button } = (globalThis as any)
  .__GHD_EXTENSION_API__.components

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
  readonly name: string
  readonly path: string
  readonly children: Map<string, ITreeNode>
  file?: any
}

interface IStatusFilters {
  readonly isIncludedInCommit: boolean
  readonly isExcludedFromCommit: boolean
  readonly isNewFile: boolean
  readonly isModifiedFile: boolean
  readonly isDeletedFile: boolean
}

const NoStatusFilters: IStatusFilters = {
  isIncludedInCommit: false,
  isExcludedFromCommit: false,
  isNewFile: false,
  isModifiedFile: false,
  isDeletedFile: false,
}

function buildTree(files: ReadonlyArray<any>): Map<string, ITreeNode> {
  const root = new Map<string, ITreeNode>()

  for (const file of files) {
    const segments = file.path.split('/')
    let level = root
    let prefix = ''

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]
      prefix = prefix.length === 0 ? segment : `${prefix}/${segment}`
      const isLeaf = i === segments.length - 1

      let node = level.get(segment)
      if (node === undefined) {
        node = {
          name: segment,
          path: prefix,
          children: new Map(),
          file: isLeaf ? file : undefined,
        }
        level.set(segment, node)
      } else if (isLeaf) {
        node.file = file
      }

      level = node.children
    }
  }

  return root
}

function isIncluded(file: any): boolean {
  return file.selection.getSelectionType() === DiffSelectionType.All
}

function statusKindOf(file: any): string {
  return String(file?.status?.kind ?? '')
}

/** Mirrors the host's applyFilterOptions: active filters exclude non-matches. */
function matchesStatusFilters(file: any, filters: IStatusFilters): boolean {
  const active = Object.values(filters)
  if (!active.some(Boolean)) {
    return true
  }

  if (filters.isIncludedInCommit && !isIncluded(file)) {
    return false
  }
  if (filters.isExcludedFromCommit && isIncluded(file)) {
    return false
  }
  if (
    filters.isNewFile &&
    statusKindOf(file) !== 'New' &&
    statusKindOf(file) !== 'Untracked'
  ) {
    return false
  }
  if (filters.isModifiedFile && statusKindOf(file) !== 'Modified') {
    return false
  }
  if (filters.isDeletedFile && statusKindOf(file) !== 'Deleted') {
    return false
  }

  return true
}

const treeCss = `
.changes-tree-header-row {
  display: flex;
  align-items: center;
  padding: var(--spacing-half);
  border-bottom: var(--base-border);
}

.changes-tree .filter-box-container {
  display: flex;
  align-items: center;
  flex: 1;
}

.changes-tree .filter-box-container input {
  border-radius: 0 var(--border-radius) var(--border-radius) 0;
}

.changes-tree .filter-button {
  border-radius: var(--border-radius) 0 0 var(--border-radius);
  border-right: none;
  font-weight: var(--font-weight-semibold);
  color: var(--text-color);
  display: inline-flex;
  align-items: center;
  position: relative;
}

.changes-tree .filter-button.active span:first-child {
  color: var(--box-selected-active-background-color);
}

.changes-tree .filter-button .active-badge {
  position: absolute;
  right: 18px;
  top: 4px;
}

.changes-tree .filter-button .active-badge .badge-bg {
  padding: 1px;
  border-radius: 50%;
  background-color: var(--secondary-button-background);
}

.changes-tree .filter-button .active-badge .badge {
  width: 5px;
  height: 5px;
  background-color: var(--box-selected-active-background-color);
  border-radius: 50%;
}

.changes-tree-header {
  padding: var(--spacing-half) var(--spacing);
  border-bottom: var(--base-border);
}

.changes-tree-header .checkbox-component {
  display: flex;
}

.changes-tree {
  flex: 1;
  overflow-y: auto;
  user-select: none;
}

.changes-tree-row {
  display: flex;
  align-items: center;
  height: 29px;
  padding-right: var(--spacing, 8px);
  cursor: default;
}

.changes-tree-row:hover {
  background: var(--box-hover-background-color, rgba(255, 255, 255, 0.04));
}

.changes-tree-row .tree-caret {
  width: 16px;
  height: 16px;
  flex: initial;
  margin-right: 2px;
  fill: var(--text-secondary-color);
}

.changes-tree-row .tree-indent {
  width: 10px;
  flex: initial;
}

.changes-tree-row .tree-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--font-size, 12px);
  color: var(--text-secondary-color);
}

.changes-tree-row .tree-count {
  margin-left: auto;
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm, 11px);
}

.changes-view-slot .filter-box-container input {
  border-radius: 0 var(--border-radius) var(--border-radius) 0;
}

.commits-tree-filter-popover {
  text-align: left;
  min-width: 240px;
}

.commits-tree-filter-popover .popover-content {
  padding: var(--spacing);
}

.commits-tree-filter-popover .filter-popover-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing);
}

.commits-tree-filter-popover .filter-popover-header h3 {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.commits-tree-filter-popover .close {
  flex-shrink: 0;
  border: 0;
  height: 16px;
  width: 16px;
  padding: 0;
  background: transparent;
  color: var(--text-secondary-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
}

.commits-tree-filter-popover .close .octicon {
  pointer-events: none;
}

.commits-tree-filter-popover .close:hover {
  color: var(--text-color);
}

.commits-tree-filter-popover .filter-options {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-half);
  margin: 0;
}

.commits-tree-filter-popover .filter-options-footer {
  border-top: var(--base-border);
  padding-top: var(--spacing-half);
  margin-top: var(--spacing-half);
  text-align: left;
}

.commits-tree-filter-popover .button-component {
  min-width: 60px;
}
`

function styleInjection() {
  return <style>{treeCss}</style>
}

interface ITreeRow {
  readonly depth: number
  readonly name: string
  readonly path: string
  readonly file?: any
  readonly descendantCount: number
}

function flattenTree(
  nodes: Map<string, ITreeNode>,
  collapsed: ReadonlySet<string>,
  depth: number,
  out: ITreeRow[]
) {
  const sorted = [...nodes.values()].sort((a, b) => {
    const aDir = a.file === undefined ? 0 : 1
    const bDir = b.file === undefined ? 0 : 1
    if (aDir !== bDir) {
      return aDir - bDir
    }
    return a.name.localeCompare(b.name)
  })

  for (const node of sorted) {
    const isFolder = node.file === undefined
    const descendantCount = isFolder ? countFiles(node) : 0
    out.push({
      depth,
      name: node.name,
      path: node.path,
      file: node.file,
      descendantCount,
    })

    if (isFolder && !collapsed.has(node.path)) {
      flattenTree(node.children, collapsed, depth + 1, out)
    }
  }
}

function countFiles(node: ITreeNode): number {
  let total = node.file !== undefined ? 1 : 0
  for (const child of node.children.values()) {
    total += countFiles(child)
  }
  return total
}

interface IStatusCounts {
  readonly included: number
  readonly excluded: number
  readonly newFiles: number
  readonly modifiedFiles: number
  readonly deletedFiles: number
}

function countStatuses(files: ReadonlyArray<any>): IStatusCounts {
  let included = 0
  let excluded = 0
  let newFiles = 0
  let modifiedFiles = 0
  let deletedFiles = 0

  for (const file of files) {
    if (isIncluded(file)) {
      included++
    } else {
      excluded++
    }

    const kind = statusKindOf(file)
    if (kind === 'New' || kind === 'Untracked') {
      newFiles++
    } else if (kind === 'Modified') {
      modifiedFiles++
    } else if (kind === 'Deleted') {
      deletedFiles++
    }
  }

  return { included, excluded, newFiles, modifiedFiles, deletedFiles }
}

function TreeCaret(props: { expanded: boolean }) {
  // Minimal inline caret (keeps the plugin free of octicon imports).
  const path = props.expanded
    ? 'M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z'
    : 'M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z'

  return (
    <svg
      className={`tree-caret${props.expanded ? ' expanded' : ''}`}
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  )
}

export class ChangesTreeView extends React.Component<any, any> {
  private filterButtonRef: any = null

  public constructor(props: any) {
    super(props)

    this.state = {
      collapsedFolders: new Set<string>(),
      filterText: '',
      statusFilters: NoStatusFilters,
      isFilterOptionsOpen: false,
    }
  }

  private toggleFolder = (path: string) => {
    this.setState((prevState: any) => {
      const collapsedFolders = new Set(prevState.collapsedFolders)
      if (collapsedFolders.has(path)) {
        collapsedFolders.delete(path)
      } else {
        collapsedFolders.add(path)
      }
      return { collapsedFolders }
    })
  }

  private onFilterTextChanged = (value: string) => {
    this.setState({ filterText: value })
  }

  private toggleFilterOptionsOpen = () => {
    this.setState((prevState: any) => ({
      isFilterOptionsOpen: !prevState.isFilterOptionsOpen,
    }))
  }

  private closeFilterOptions = () => {
    this.setState({ isFilterOptionsOpen: false })
  }

  private onStatusFilterChanged = (key: string) => (event: any) => {
    this.setState((prevState: any) => ({
      statusFilters: {
        ...prevState.statusFilters,
        [key]: event.currentTarget.checked,
      },
    }))
  }

  private clearStatusFilters = () => {
    this.setState({ statusFilters: NoStatusFilters })
  }

  private renderFilterPopover(files: ReadonlyArray<any>) {
    const filters: IStatusFilters = this.state.statusFilters
    const counts = countStatuses(files)
    const activeCount = Object.values(filters).filter(Boolean).length

    const checkboxRow = (key: string, label: string, count: number) => (
      <Checkbox
        key={key}
        value={filters[key] ? CheckboxValue.On : CheckboxValue.Off}
        onChange={this.onStatusFilterChanged(key)}
        label={`${label} (${count})`}
      />
    )

    return (
      <Popover
        className="filter-popover commits-tree-filter-popover"
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
        <div className="commits-tree-filter-options">
          {checkboxRow('isIncludedInCommit', 'Included in commit', counts.included)}
          {checkboxRow('isExcludedFromCommit', 'Excluded from commit', counts.excluded)}
          {checkboxRow('isNewFile', 'New files', counts.newFiles)}
          {checkboxRow('isModifiedFile', 'Modified files', counts.modifiedFiles)}
          {checkboxRow('isDeletedFile', 'Deleted files', counts.deletedFiles)}
        </div>
        {activeCount > 0 ? (
          <div className="filter-options-footer">
            <Button onClick={this.clearStatusFilters}>
              Clear filters
            </Button>
          </div>
        ) : null}
      </Popover>
    )
  }

  public render() {
    const { files, availableWidth, includeAllValue, onIncludeAllChanged } = this.props
    const filterText = this.state.filterText.trim().toLowerCase()
    const statusFilters: IStatusFilters = this.state.statusFilters
    const statusActive = Object.values(statusFilters).some(Boolean)

    const visibleFiles = files.filter(file => {
      if (
        filterText.length > 0 &&
        !file.path.toLowerCase().includes(filterText)
      ) {
        return false
      }
      return matchesStatusFilters(file, statusFilters)
    })

    const tree = buildTree(visibleFiles)

    const rows: ITreeRow[] = []
    flattenTree(tree, this.state.collapsedFolders, 0, rows)

    const counts = countStatuses(files)
    const activeCount = Object.values(statusFilters).filter(Boolean).length

    return (
      <div className="changes-tree file-list">
        {styleInjection()}

        <div className="changes-tree-header-row">
          <div className="filter-box-container">
            <button
              className={`button-component filter-button${
                activeCount > 0 ? ' active' : ''
              }`}
              onClick={this.toggleFilterOptionsOpen}
              ariaExpanded={this.state.isFilterOptionsOpen}
              onButtonRef={(ref: any) => (this.filterButtonRef = ref)}
              title="Filter Options"
              ariaLabel="Filter Options"
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
            </button>

            <TextBox
              value={this.state.filterText}
              placeholder={'Filter'}
              className="filter-list-filter-field"
              onValueChanged={this.onFilterTextChanged}
            />

            {this.props.viewSwitch}
          </div>

          {this.state.isFilterOptionsOpen
            ? this.renderFilterPopover(files)
            : null}

          <div className="checkbox-container">
            <Checkbox
              value={includeAllValue}
              onChange={(event: any) =>
                onIncludeAllChanged(event.currentTarget.checked)
              }
              ariaLabel="Include all changed files"
              className="changes-tree-check-all"
              label={`${files.length} changed file${files.length === 1 ? '' : 's'}`}
            />
          </div>
        </div>

        {rows.map(row => {
          const isFolder = row.file === undefined
          const include =
            !isFolder &&
            row.file.selection.getSelectionType() === DiffSelectionType.All

          return (
            <div
              key={row.path}
              className={`changes-tree-row list-item${include ? ' included' : ''}`}
              style={{ paddingLeft: 8 + row.depth * 14 }}
              onClick={() => {
                if (isFolder) {
                  this.toggleFolder(row.path)
                } else {
                  this.props.onSelectionChanged([row.file])
                }
              }}
              onContextMenu={
                isFolder
                  ? undefined
                  : (event: any) => {
                      event.preventDefault()
                      this.props.onFileContextMenu(row.file, event)
                    }
              }
              title={row.path}
            >
              {isFolder ? (
                <TreeCaret
                  expanded={!this.state.collapsedFolders.has(row.path)}
                />
              ) : (
                <span className="tree-indent" aria-hidden="true" />
              )}

              {isFolder ? (
                <span className="tree-name">{row.name}</span>
              ) : (
                <ChangedFile
                  file={{ ...row.file, path: row.name }}
                  include={include}
                  availableWidth={Math.max(
                    140,
                    (availableWidth ?? 340) - 24 - row.depth * 14
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
          )
        })}
      </div>
    )
  }
}

// Registered after the component declaration (class declarations are not
// hoisted). While registered, the tree view is available via the icon
// switch; the built-in list remains the default.
;(globalThis as any).__GHD_EXTENSION_API__.registerChangesFileView({
  id: 'changes-tree',
  title: 'Tree',
  component: ChangesTreeView,
})
