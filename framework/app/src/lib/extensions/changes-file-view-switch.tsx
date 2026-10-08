import * as React from 'react'

import { Octicon } from '../../ui/octicons'
import * as octicons from '../../ui/octicons/octicons.generated'
import {
  BuiltInChangesFileViewId,
  getActiveChangesFileViewId,
  getRegisteredChangesFileView,
  setActiveChangesFileView,
  subscribeChangesFileView,
} from './extension-points'

/**
 * Icon switch (List / plugin view) for the changes file list, rendered
 * inside the host's filter box row — mirroring the view toggles of VS Code's
 * source control panel. Renders nothing while no plugin view is registered,
 * so the native experience stays untouched.
 */
export class ChangesFileViewSwitch extends React.Component<
  any,
  { version: number }
> {
  private unsubscribe: (() => void) | null = null

  public constructor(props: any) {
    super(props)

    this.state = { version: 0 }
  }

  public componentWillMount() {
    this.unsubscribe = subscribeChangesFileView(() => {
      this.setState((prevState: { version: number }) => ({
        version: prevState.version + 1,
      }))
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
      return null
    }

    const activeId = getActiveChangesFileViewId()
    const isBuiltInActive = activeId === BuiltInChangesFileViewId

    // Single-button toggle: the icon shows the view you'll switch TO.
    const target = isBuiltInActive ? view : null
    const title = isBuiltInActive
      ? `View as ${view.title}`
      : __DARWIN__
        ? 'View as List'
        : 'View as list'

    return (
      <div className="changes-view-switch-icons">
        {this.injectStylesOnce()}
        <button
          className={`changes-view-switch-icon${isBuiltInActive ? '' : ' selected'}`}
          title={title}
          aria-label={title}
          onClick={() =>
            setActiveChangesFileView(
              isBuiltInActive ? view.id : BuiltInChangesFileViewId
            )
          }
        >
          <Octicon symbol={target ? octicons.fileDirectory : octicons.listUnordered} />
        </button>
      </div>
    )
  }

  private stylesInjected = false

  private injectStylesOnce(): JSX.Element | null {
    if (!this.stylesInjected) {
      this.stylesInjected = true
      const style = document.createElement('style')
      style.textContent = switchCss
      document.head.appendChild(style)
    }
    return null
  }
}

const switchCss = `
.changes-view-switch-icons {
  display: flex;
  align-items: center;
  margin-left: var(--spacing-half);
}

.changes-view-switch-icon {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--text-secondary-color);
  width: 24px;
  height: var(--text-field-height);
  padding: 0;
  margin-left: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: default;
  border-radius: var(--border-radius);
}

.changes-view-switch-icon:hover {
  color: var(--text-color);
  background: var(--box-hover-background-color, rgba(255, 255, 255, 0.07));
}

.changes-view-switch-icon.selected {
  color: var(--box-selected-active-text-color);
  background: var(--box-selected-active-background-color);
}

.changes-view-switch-icon .octicon {
  fill: currentColor;
}
`
