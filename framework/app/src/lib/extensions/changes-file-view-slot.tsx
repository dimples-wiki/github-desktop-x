import * as React from 'react'

import {
  BuiltInChangesFileViewId,
  getActiveChangesFileViewId,
  getRegisteredChangesFileView,
  setActiveChangesFileView,
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
}

/**
 * Renders the plugin-provided changes file view when the user switched to
 * it, and the built-in flat list otherwise (the default). When a plugin
 * view is available, a small List/Tree switch row lets the user toggle —
 * the built-in list remains the default and always stays available.
 */
export class ChangesFileViewSlot extends React.Component<
  IChangesFileViewSlotProps,
  IChangesFileViewSlotState
> {
  private unsubscribe: (() => void) | null = null

  public constructor(props: IChangesFileViewSlotProps) {
    super(props)

    this.state = { version: 0 }
  }

  public componentWillMount() {
    this.unsubscribe = subscribeChangesFileView(() => {
      this.setState(prevState => ({ version: prevState.version + 1 }))
    })
  }

  public componentWillUnmount() {
    if (this.unsubscribe !== null) {
      this.unsubscribe()
      this.unsubscribe = null
    }
  }

  public render() {
    const view = getRegisteredChangesFileView()

    if (view === undefined) {
      return this.props.fallback
    }

    const activeId = getActiveChangesFileViewId()
    const showPluginView = activeId === view.id

    return (
      <div className="changes-view-slot">
        {injectSwitchStylesOnce()}
        {this.renderSwitch(view.id, view.title)}
        {showPluginView ? this.renderPluginView(view) : this.props.fallback}
      </div>
    )
  }

  private renderSwitch(viewId: string, viewTitle: string) {
    const activeId = getActiveChangesFileViewId()

    return (
      <div className="changes-view-switch" role="tablist">
        <button
          className={`changes-view-switch-item${
            activeId === BuiltInChangesFileViewId ? ' selected' : ''
          }`}
          onClick={() => setActiveChangesFileView(BuiltInChangesFileViewId)}
        >
          List
        </button>
        <button
          className={`changes-view-switch-item${
            activeId === viewId ? ' selected' : ''
          }`}
          onClick={() => setActiveChangesFileView(viewId)}
        >
          {viewTitle}
        </button>
      </div>
    )
  }

  private renderPluginView(view: {
    id: string
    component: ComponentClassLike
  }) {
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
        files={this.props.files}
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

// ── switch styles (injected once; the framework is compiled into the app
// but keeping the styles attached to the slot avoids touching upstream scss)

let switchStylesInjected = false

function injectSwitchStylesOnce(): JSX.Element | null {
  if (!switchStylesInjected) {
    switchStylesInjected = true
    const style = document.createElement('style')
    style.textContent = switchCss
    document.head.appendChild(style)
  }
  return null
}

const switchCss = `
.changes-view-slot { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.changes-view-switch {
  display: flex; gap: 0; padding: var(--spacing-half) var(--spacing-half) 0;
}
.changes-view-switch-item {
  appearance: none; border: var(--base-border); background: var(--background-color);
  color: var(--text-secondary-color); font-size: var(--font-size-sm);
  height: 22px; padding: 0 var(--spacing); cursor: default;
  border-radius: 0; margin-right: -1px;
}
.changes-view-switch-item:first-child {
  border-radius: var(--border-radius) 0 0 var(--border-radius);
}
.changes-view-switch-item:last-child {
  border-radius: 0 var(--border-radius) var(--border-radius) 0;
}
.changes-view-switch-item.selected {
  background: var(--box-selected-active-background-color);
  border-color: var(--box-border-accent-color);
  color: var(--box-selected-active-text-color);
  position: relative; z-index: 1;
}
.changes-view-slot .changes-list-container,
.changes-view-slot .changes-tree { flex: 1; }
`
