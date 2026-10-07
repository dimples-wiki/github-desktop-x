import * as React from 'react'

import {
  getRegisteredChangesFileView,
  subscribeChangesFileView,
} from './extension-points'

interface IChangesFileViewSlotProps {
  readonly fallback: JSX.Element
  readonly files: ReadonlyArray<any>
  readonly onSelectionChanged: (files: ReadonlyArray<any>) => void
}

interface IChangesFileViewSlotState {
  /** Bumped whenever a plugin (un)registers a changes file view. */
  readonly version: number
}

/**
 * Renders the plugin-provided changes file view while one is registered,
 * and falls back to the built-in flat list otherwise. Subscribes to the
 * registry so views appear/disappear without a restart.
 *
 * This component is the single integration point inside the changes list:
 * upstream hands it the fallback element plus the data a plugin needs, and
 * stays otherwise unaware of the extension system.
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

    const View = view.component

    return (
      <View
        files={this.props.files}
        onSelectionChanged={this.props.onSelectionChanged}
      />
    )
  }
}
