import * as React from 'react'

import { TextBox } from '../../ui/lib/text-box'
import { ChangesFileViewSwitch } from './changes-file-view-switch'
import {
  getActiveChangesFileViewId,
  getRegisteredChangesFileView,
  subscribeChangesFileView,
} from './extension-points'

// Uses the host's global `log` (same as the rest of the renderer).

declare const log: any

interface IChangesFileViewSlotProps {
  readonly fallback: JSX.Element

  /** All changed files of the working directory. */
  readonly files: ReadonlyArray<any>

  /** Notify the host that the user selected these files (diff follows). */
  readonly onSelectionChanged: (files: ReadonlyArray<any>) => void

  /** Host callback toggling a file's (or a set of files') inclusion. */
  readonly onIncludeChanged: (
    file: any | ReadonlyArray<any>,
    include: boolean
  ) => void

  /** Tri-state of the "include all" checkbox (host CheckboxValue). */
  readonly includeAllValue: any

  /** Host callback setting inclusion for every file at once. */
  readonly onIncludeAllChanged: (include: boolean) => void
}

interface IChangesFileViewSlotState {
  /** Bumped whenever a plugin (un)registers a changes file view. */
  readonly version: number

  /** The filter text of the plugin view's own search box. */
  readonly filterText: string
}

/**
 * Renders the plugin-provided changes file view when the user switched to
 * it (via the List/Tree icon switch in its filter row), and the built-in
 * flat list otherwise — which is the default at all times.
 *
 * While a plugin view is active, the slot provides the same filter row the
 * built-in list has (view switch icons + search box), so both views feel
 * identical.
 */
export class ChangesFileViewSlot extends React.Component<
  IChangesFileViewSlotProps,
  IChangesFileViewSlotState
> {
  private unsubscribe: (() => void) | null = null

  public constructor(props: IChangesFileViewSlotProps) {
    super(props)

    this.state = { version: 0, filterText: '' }
  }

  public componentWillMount() {
    this.unsubscribe = subscribeChangesFileView(() => {
      this.setState(
        (prevState: { version: number }) => ({
          version: prevState.version + 1,
        })
      )
    })
  }

  public componentWillUnmount() {
    if (this.unsubscribe !== null) {
      this.unsubscribe()
      this.unsubscribe = null
    }
  }

  private onFilterTextChanged = (value: string) => {
    this.setState({ filterText: value })
  }

  public render() {
    const view = getRegisteredChangesFileView()

    if (view === undefined) {
      return this.props.fallback
    }

    const activeId = getActiveChangesFileViewId()

    if (activeId !== view.id) {
      return this.props.fallback
    }

    // Plugin view active: render its own filter row + the filtered view.
    const filterText = this.state.filterText.trim().toLowerCase()
    const filteredFiles =
      filterText.length === 0
        ? this.props.files
        : this.props.files.filter(file =>
            file.path.toLowerCase().includes(filterText)
          )

    return (
      <div className="changes-view-slot">
        {injectSlotStylesOnce()}
        <div className="filter-box-container">
          <TextBox
            value={this.state.filterText}
            placeholder={'Filter'}
            className="filter-list-filter-field"
            onValueChanged={this.onFilterTextChanged}
          />
          <ChangesFileViewSwitch />
        </div>
        {this.renderPluginView(view, filteredFiles)}
      </div>
    )
  }

  private renderPluginView(
    view: { id: string; component: ComponentClassLike },
    files: ReadonlyArray<any>
  ) {
    const View = view.component

    // A misbehaving plugin must never take the host down.
    if (typeof View !== 'function') {
      log.error(
        `[extensions] changes file view '${view.id}' has an invalid component`
      )
      return this.props.fallback
    }

    return (
      <View
        files={files}
        onSelectionChanged={this.props.onSelectionChanged}
        onIncludeChanged={this.props.onIncludeChanged}
        includeAllValue={this.props.includeAllValue}
        onIncludeAllChanged={this.props.onIncludeAllChanged}
      />
    )
  }
}

interface ComponentClassLike {
  new (props: any): any
}

// ── slot layout styles (injected once; attached to the slot to avoid
// touching upstream scss files)

let slotStylesInjected = false

function injectSlotStylesOnce(): JSX.Element | null {
  if (!slotStylesInjected) {
    slotStylesInjected = true
    const style = document.createElement('style')
    style.textContent = slotCss
    document.head.appendChild(style)
  }
  return null
}

const slotCss = `
.changes-view-slot {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.changes-view-slot .filter-box-container {
  display: flex;
  align-items: center;
  background: var(--box-alt-background-color);
  padding: var(--spacing-half);
  border-bottom: var(--base-border);
  margin-bottom: 0;
}

.changes-view-slot .filter-box-container input {
  border-radius: 0 var(--border-radius) var(--border-radius) 0;
}

.changes-view-slot .filter-list-filter-field {
  flex: 1;
}
`
