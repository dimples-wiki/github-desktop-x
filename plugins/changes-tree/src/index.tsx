import { React } from './ghd'

/**
 * The "Tree" changes file view: renders the working directory changes as a
 * collapsible folder hierarchy.
 *
 * Leaf rows reuse the host's `ChangedFile` component, so include checkboxes,
 * the right-hand status badge and hover behavior are exactly the same as the
 * built-in flat list. A tri-state "include all" header with the changed
 * files count is rendered above the tree. Keyboard navigation and the
 * context menu remain provided by the built-in list — switch back any time
 * with the List/Tree icon switch.
 */

const api = (globalThis as any).__GHD_EXTENSION_API__
const { Checkbox, ChangedFile } = api.components
const CheckboxValue = api.CheckboxValue
const DiffSelectionType = api.DiffSelectionType

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
    const { files } = this.props
    const tree = buildTree(files)

    const rows: ITreeRow[] = []
    flattenTree(tree, this.state.collapsedFolders, 0, rows)

    return (
      <div className="file-list">
        <div className="list-focus-container changes-tree-focus">
          <div className="changes-tree">
        {styleInjection()}
        {this.renderHeaderRow()}

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
                  file={row.file}
                  include={include}
                  availableWidth={Math.max(
                    140,
                    (this.props.availableWidth ?? 340) -
                      24 -
                      row.depth * 14
                  )}
                  disableSelection={false}
                  focused={false}
                  onIncludeChanged={this.props.onIncludeChanged}
                />
              )}

              {isFolder ? (
                <span className="tree-count">{row.descendantCount}</span>
              ) : null}
            </div>
          )
        })}
      </div>
        </div>
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

const treeCss = `
.changes-tree-focus {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.changes-tree-header {
  padding: var(--spacing-half) var(--spacing);
  border-bottom: var(--base-border);
}
.changes-tree-header .checkbox-component { display: flex; }
.changes-tree { flex: 1; overflow-y: auto; user-select: none; }
.changes-tree-row {
  display: flex; align-items: center;
  padding-right: var(--spacing, 8px); cursor: default;
}
.changes-tree-row:hover { background: var(--box-hover-background-color, rgba(255,255,255,0.04)); }
.changes-tree-row .tree-caret {
  width: 16px; height: 16px; flex: initial; margin-right: 2px;
  fill: var(--text-secondary-color);
}
.changes-tree-row .tree-indent { width: 10px; flex: initial; }
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
// hoisted). While registered, the tree view is available via the icon
// switch; the built-in list remains the default.
api.registerChangesFileView({
  id: 'changes-tree',
  title: 'Tree',
  component: ChangesTreeView,
})
