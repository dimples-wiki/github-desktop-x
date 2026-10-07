import { React } from './ghd'

/**
 * The "Tree" changes file view: renders the working directory changes as a
 * collapsible folder hierarchy instead of the built-in flat list.
 *
 * Clicking a file selects it in the host (the diff pane follows), exactly
 * like clicking a row in the flat list. Keyboard navigation, include
 * checkboxes and the context menu remain provided by the built-in list —
 * switch back by removing this plugin.
 */

const api = (globalThis as any).__GHD_EXTENSION_API__

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
  readonly file?: any
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
        node = { name: segment, path: prefix, children: new Map(), file: isLeaf ? file : undefined }
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
  const kind = file?.status?.kind
  return StatusColors[kind] ?? '#8b949e'
}

function statusLabel(file: any): string {
  return String(file?.status?.kind ?? 'Modified')
}

function styleInjection(): JSX.Element {
  return (
    <style>{`
      .changes-tree { flex: 1; overflow-y: auto; user-select: none; }
      .changes-tree-row {
        display: flex; align-items: center; height: 29px;
        padding-right: var(--spacing, 8px); cursor: default;
        border-bottom: 1px solid var(--box-border-color, rgba(255,255,255,0.07));
      }
      .changes-tree-row:hover { background: var(--box-hover-background-color, rgba(255,255,255,0.04)); }
      .changes-tree-row .tree-caret {
        width: 16px; height: 16px; flex: initial; margin-right: 2px;
        fill: var(--text-secondary-color); transition: transform 100ms ease;
      }
      .changes-tree-row .tree-caret.expanded { transform: rotate(90deg); }
      .changes-tree-row .tree-status-dot {
        width: 7px; height: 7px; border-radius: 50%; flex: initial; margin-right: 6px;
      }
      .changes-tree-row .tree-name {
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        font-size: var(--font-size, 12px); color: var(--text-color);
      }
      .changes-tree-row .tree-count {
        margin-left: auto; color: var(--text-secondary-color);
        font-size: var(--font-size-sm, 11px);
      }
    `}</style>
  )
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

  public render() {
    const { files } = this.props
    const tree = buildTree(files)

    const rows: ITreeRow[] = []
    flattenTree(tree, this.state.collapsedFolders, 0, rows)

    return (
      <div className="changes-tree">
        {styleInjection()}
        {rows.map(row => {
          const isFolder = row.file === undefined

          return (
            <div
              key={row.path}
              className="changes-tree-row"
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
                <OcticonLike
                  symbol={
                    this.state.collapsedFolders.has(row.path)
                      ? chevronRightPath
                      : chevronDownPath
                  }
                />
              ) : (
                <span
                  className="tree-status-dot"
                  style={{ background: statusColor(row.file) }}
                  title={statusLabel(row.file)}
                />
              )}

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

// Minimal inline caret (keeps the plugin free of octicon imports).
const chevronRightPath =
  'M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z'
const chevronDownPath =
  'M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z'

function OcticonLike(props: { symbol: string }) {
  return (
    <svg
      className="tree-caret"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={props.symbol} />
    </svg>
  )
}

// Registered after the component declaration (class declarations are not
// hoisted). While registered, the tree view replaces the built-in flat list.
api.registerChangesFileView({
  id: 'changes-tree',
  title: 'Tree',
  component: ChangesTreeView,
})
