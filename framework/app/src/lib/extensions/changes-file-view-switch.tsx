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
 * View toggle for the changes file list: a single icon button that shows
 * the **currently active** view (list icon for the built-in flat list, a
 * tree icon when a plugin tree view is active) and switches to the other
 * view on click — the same convention as the view toggles in VS Code's
 * source control panel. Renders nothing while no plugin view is
 * registered, so the native experience stays untouched.
 */
export class ChangesFileViewSwitch extends React.Component<
  any,
  { version: number }
> {
  private unsubscribe: (() => void) | null = null
  private stylesInjected = false

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

    const isListActive =
      getActiveChangesFileViewId() === BuiltInChangesFileViewId

    return (
      <div className="changes-view-switch-icons">
        {this.injectStylesOnce()}
        <button
          className="changes-view-switch-icon"
          title={
            isListActive
              ? `View as ${view.title}`
              : __DARWIN__
              ? 'View as List'
              : 'View as list'
          }
          aria-label={
            isListActive
              ? `View as ${view.title}`
              : __DARWIN__
              ? 'View as List'
              : 'View as list'
          }
          onClick={() =>
            setActiveChangesFileView(
              isListActive ? view.id : BuiltInChangesFileViewId
            )
          }
        >
          {isListActive ? (
            <Octicon symbol={octicons.listUnordered} />
          ) : (
            <ListTreeIcon />
          )}
        </button>
      </div>
    )
  }

  private injectStylesOnce() {
    if (!this.stylesInjected) {
      this.stylesInjected = true
      const style = document.createElement('style')
      style.textContent = switchCss
      document.head.appendChild(style)
    }
    return null
  }
}

/** A hand-drawn "list tree" glyph (three rows joined by a left rail). */
function ListTreeIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M1.75 2.25a.75.75 0 0 1 .75-.75h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1-.75-.75Z"
      />
      <path d="M2 6h4.5v1.5H2z" />
      <path d="M2 10.5h4.5V12H2z" />
      <path d="M6.75 7.5h7.5a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5Z" />
      <path d="M6.75 11.5h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1 0-1.5Z" />
      <path d="M2.75 2.5v9h1v1.5h-1A1.75 1.75 0 0 1 1 11.25V3.25a.75.75 0 0 1 1.5 0Z" />
    </svg>
  )
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
  width: 26px;
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

.changes-view-switch-icon .octicon,
.changes-view-switch-icon svg {
  fill: currentColor;
  display: block;
}
`
