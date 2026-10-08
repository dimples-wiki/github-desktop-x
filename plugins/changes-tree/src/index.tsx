import { React } from './ghd'

/**
 * The "Tree" changes file view: renders the working directory changes as a
 * collapsible folder hierarchy.
 *
 * Parity with the built-in flat list:
 *  - per-file include checkboxes (commit staging) and a tri-state
 *    "include all" header checkbox with a "N of M changed files" count,
 *  - clicking a file selects it in the host (the diff pane follows).
 *
 * Keyboard navigation and the context menu remain provided by the built-in
 * list — switch back any time with the List/Tree switch above the list.
 */

const api = (globalThis as any).__GHD_EXTENSION_API__
const { Checkbox } = api.components
const CheckboxValue = api.CheckboxValue
const DiffSelectionType = api.DiffSelectionType

const StatusColors: Record<string, string> = {
  New: '#3fb950',
  Modified: '#d29922',
  Deleted: '#f85149',
  Renamed: '#a371f7',
  Copied: '#a371f7',
  Conflicted: '#f85149',
  Untracked: '#d29922',
}

interface ITreeNode {
  readonly name: string
  readonly path: string
  readonly children: Map<string, ITreeNode>
  /** The changed file this node represents (leaf nodes only). */
  file?: any
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

function statusColor(file: any): string {
  return StatusColors[file?.status?.kind] ?? '#8b949e'
}

function statusLabel(file: any): string {
  return String(file?.status?.kind ?? 'Modified')
}

/** Whether the file is staged for the next commit (include checkbox on). */
function isIncluded(file: any): boolean {
  return file.selection.getSelectionType() === DiffSelectionType.All
}

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

export class ChangesTreeView extends React.Component<any, any> {
  public constructor(props: any) {
    super(props)

    this.state = { collapsedFolders: new Set<string>() }
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

  private renderHeaderRow() {
    const { files, includeAllValue, onIncludeAllChanged } = this.props

    return (
      <div className="changes-tree-header">
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
    )
  }

  public render() {
    const { files, onIncludeChanged } = this.props
    const tree = buildTree(files)

    const rows: ITreeRow[] = []
    flattenTree(tree, this.state.collapsedFolders, 0, rows)

    return (
      <div className="changes-tree">
        {styleInjection()}
        {this.renderHeaderRow()}

        {rows.map(row => {
          const isFolder = row.file === undefined
          const included = !isFolder && isIncluded(row.file)

          return (
            <div
              key={row.path}
              className={`changes-tree-row${included ? ' included' : ''}`}
              style={{ paddingLeft: 8 + row.depth * 14 }}
              onClick={() => {
                if (isFolder) {
                  this.toggleFolder(row.path)
                } else {
                  this.props.onSelectionChanged([row.file])
                }
              }}
              title={row.path}
            >
              {isFolder ? (
                <TreeCaret
                  expanded={!this.state.collapsedFolders.has(row.path)}
                />
              ) : (
                <input
                  type="checkbox"
                  className="tree-include-checkbox"
                  checked={included}
                  onClick={(event: any) => event.stopPropagation()}
                  onChange={(event: any) =>
                    onIncludeChanged(row.file, event.currentTarget.checked)
                  }
                />
              )}

              {!isFolder ? (
                <span
                  className="tree-status-dot"
                  style={{ background: statusColor(row.file) }}
                  title={statusLabel(row.file)}
                />
              ) : null}

              <span className="tree-name">{row.name}</span>

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

function TreeCaret(props: { expanded: boolean }) {
  // Minimal inline caret (keeps the plugin free of octicon imports).
  const path = props.expanded
    ? 'M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z'
    : 'M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z'

  return (
    <svg
      className="tree-caret expanded"
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

const treeCss = `
.changes-tree-header {
  padding: var(--spacing-half) var(--spacing);
  border-bottom: var(--base-border);
}
.changes-tree-header .checkbox-component { display: flex; }
.changes-tree { flex: 1; overflow-y: auto; user-select: none; }
.changes-tree-row {
  display: flex; align-items: center; height: 29px;
  padding-right: var(--spacing, 8px); cursor: default;
  border-bottom: 1px solid var(--box-border-color, rgba(255,255,255,0.07));
}
.changes-tree-row:hover { background: var(--box-hover-background-color, rgba(255,255,255,0.04)); }
.changes-tree-row.included .tree-name { color: var(--text-color); }
.changes-tree-row .tree-caret {
  width: 16px; height: 16px; flex: initial; margin-right: 2px;
  fill: var(--text-secondary-color);
}
.changes-tree-row .tree-status-dot {
  width: 7px; height: 7px; border-radius: 50%; flex: initial;
  margin-right: 6px; margin-left: 2px;
}
.changes-tree-row .tree-include-checkbox {
  margin: 0 6px 0 2px; flex: initial; accent-color: var(--accent-color, #2f6feb);
}
.changes-tree-row .tree-name {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: var(--font-size, 12px); color: var(--text-secondary-color);
}
.changes-tree-row .tree-count {
  margin-left: auto; color: var(--text-secondary-color);
  font-size: var(--font-size-sm, 11px);
}
`

// Registered after the component declaration (class declarations are not
// hoisted). While registered, the tree view is available via the List/Tree
// switch; the built-in list remains the default.
api.registerChangesFileView({
  id: 'changes-tree',
  title: 'Tree',
  component: ChangesTreeView,
})
