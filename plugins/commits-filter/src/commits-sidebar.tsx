import { React } from './ghd'
import { Popover, PopoverAnchorPosition, PopoverDecoration, classNames } from './ghd'
import {
  EmptyCommitFilter,
  ICommitFilter,
  filterCommits,
  getCommitAuthors,
  isEmptyCommitFilter,
  isValidDateString,
} from './commits-filter-logic'

const { CommitList, TextBox, Select, Button, Octicon } = (globalThis as any)
  .__GHD_EXTENSION_API__.components
const octicons = (globalThis as any).__GHD_EXTENSION_API__.octicons
const PopupType = (globalThis as any).__GHD_EXTENSION_API__.PopupType
const __DARWIN__ = (globalThis as any).__GHD_EXTENSION_API__.isDarwin

/** If we're within this many rows from the bottom, load the next history batch. */
const CloseToBottomThreshold = 10

const AllAuthorsValue = ''

interface ICommitsSidebarState {
  readonly filter: ICommitFilter

  /** Whether the advanced filters popover (description/author/dates) is open. */
  readonly isFilterOptionsOpen: boolean
}

/**
 * The "Commits" section: the history commit list of the current branch,
 * extended with client-side filtering (author / message / description /
 * author date range).
 *
 * The filter bar mirrors the built-in changes list filter: a filter-options
 * button joined with the message search box; the advanced filters live in a
 * popover anchored to that button. The list itself is the host's CommitList,
 * so selection, context menus and pagination behave exactly like History.
 */
export class CommitsSidebar extends React.Component<any, ICommitsSidebarState> {
  private readonly commitListRef = { current: null }
  private filterButtonRef: any = null
  private loadChangedFilesTimer: any = null
  private loadingMoreCommitsPromise: Promise<void> | null = null

  /** Authors of the currently loaded commits (render scope cache). */
  private cachedAuthors: ReadonlyArray<any> = []

  public constructor(props: any) {
    super(props)

    this.state = {
      filter: EmptyCommitFilter,
      isFilterOptionsOpen: false,
    }
  }

  public componentWillMount() {
    // Make sure the compare state (the commits of the current branch) is
    // initialized even when the user jumps straight to this tab.
    this.props.dispatcher.initializeCompare(this.props.repository)
  }

  /** Focuses the commit list (used by the "Show Commits" menu accelerator). */
  public focus() {
    ;(this.commitListRef.current as any)?.focus()
  }

  private toggleFilterOptionsOpen = () => {
    this.setState((prevState: any) => ({
      isFilterOptionsOpen: !prevState.isFilterOptionsOpen,
    }))
  }

  private closeFilterOptions = () => {
    if (this.state.isFilterOptionsOpen) {
      this.setState({ isFilterOptionsOpen: false })
    }
  }

  private onFilterChanged = (update: Partial<ICommitFilter>) => {
    this.setState((prevState: any) => ({
      filter: { ...prevState.filter, ...update },
    }))
  }

  private onMessageTextChanged = (value: string) => {
    this.onFilterChanged({
      messageTerms: value
        .split(/\s+/)
        .map((term: string) => term.trim())
        .filter((term: string) => term.length > 0),
    })
  }

  private onDescriptionTextChanged = (value: string) => {
    this.onFilterChanged({ descriptionTerm: value })
  }

  private onAuthorChanged = (event: any) => {
    const email = event.currentTarget.value

    this.onFilterChanged({ authorEmails: email === '' ? [] : [email] })
  }

  private onDateFromChanged = (value: string) => {
    this.onFilterChanged({ dateFrom: value.trim().length === 0 ? null : value })
  }

  private onDateToChanged = (value: string) => {
    this.onFilterChanged({ dateTo: value.trim().length === 0 ? null : value })
  }

  private onClearFilters = () => {
    this.setState({ filter: EmptyCommitFilter })
  }

  private onCommitsSelected = (commits: any, isContiguous: boolean) => {
    this.props.dispatcher.changeCommitSelection(
      this.props.repository,
      commits.map((c: any) => c.sha),
      isContiguous
    )

    // Debounced changed-files load for the freshly selected commit(s).
    if (this.loadChangedFilesTimer !== null) {
      clearTimeout(this.loadChangedFilesTimer)
    }
    this.loadChangedFilesTimer = setTimeout(() => {
      this.loadChangedFilesTimer = null
      this.props.dispatcher.loadChangedFilesForCurrentSelection(
        this.props.repository
      )
    }, 200)
  }

  private onScroll = (start: number, end: number) => {
    const { commitSHAs } = this.props.state.compareState

    if (commitSHAs.length - end <= CloseToBottomThreshold) {
      if (this.loadingMoreCommitsPromise != null) {
        return
      }

      this.loadingMoreCommitsPromise = this.props.dispatcher
        .loadNextCommitBatch(this.props.repository)
        .then(() => {
          window.setTimeout(() => {
            this.loadingMoreCommitsPromise = null
          }, 500)
        })
    }
  }

  /** The number of advanced-filter dimensions currently active. */
  private countAdvancedFilters(filter: ICommitFilter): number {
    let count = 0
    if (filter.authorEmails.length > 0) {
      count++
    }
    if (filter.descriptionTerm.trim().length > 0) {
      count++
    }
    if (filter.dateFrom !== null) {
      count++
    }
    if (filter.dateTo !== null) {
      count++
    }
    return count
  }

  private renderAdvancedFilters(filter: ICommitFilter) {
    const dateFromInvalid =
      filter.dateFrom !== null && !isValidDateString(filter.dateFrom)
    const dateToInvalid =
      filter.dateTo !== null && !isValidDateString(filter.dateTo)

    return (
      <div className="commits-filter-options">
        <TextBox
          className="commits-filter-field"
          placeholder={
            __DARWIN__ ? 'Filter by Description' : 'Filter by description'
          }
          ariaLabel={
            __DARWIN__ ? 'Filter by Description' : 'Filter by description'
          }
          value={filter.descriptionTerm}
          displayClearButton={filter.descriptionTerm.length > 0}
          onValueChanged={this.onDescriptionTextChanged}
        />

        <div className="commits-filter-row">
          <Select
            className="commits-filter-author"
            value={filter.authorEmails[0] ?? AllAuthorsValue}
            onChange={this.onAuthorChanged}
          >
            <option value={AllAuthorsValue}>
              {__DARWIN__ ? 'All Authors' : 'All authors'}
            </option>
            {this.cachedAuthors.map((author: any) => (
              <option key={author.email} value={author.email}>
                {author.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="commits-filter-row commits-filter-dates">
          <TextBox
            className={classNames('commits-filter-date-field', {
              'invalid-date': dateFromInvalid,
            })}
            placeholder="YYYY-MM-DD"
            ariaLabel="From date"
            value={filter.dateFrom ?? ''}
            onValueChanged={this.onDateFromChanged}
          />
          <span className="commits-filter-dates-separator" aria-hidden="true">
            –
          </span>
          <TextBox
            className={classNames('commits-filter-date-field', {
              'invalid-date': dateToInvalid,
            })}
            placeholder="YYYY-MM-DD"
            ariaLabel="To date"
            value={filter.dateTo ?? ''}
            onValueChanged={this.onDateToChanged}
          />
        </div>

        <div
          className={classNames('commits-filter-date-hint', {
            visible: dateFromInvalid || dateToInvalid,
          })}
          role="alert"
        >
          {__DARWIN__ ? 'Invalid Date' : 'Invalid date'} — YYYY-MM-DD
        </div>
      </div>
    )
  }

  private renderFilterPopover(filter: ICommitFilter) {
    const filtersActive = !isEmptyCommitFilter(filter)

    return (
      <Popover
        className="filter-popover commits-filter-popover"
        ariaLabelledby="commits-filter-header"
        anchor={this.filterButtonRef}
        anchorPosition={PopoverAnchorPosition.BottomRight}
        decoration={PopoverDecoration.Balloon}
        onMousedownOutside={this.closeFilterOptions}
        onClickOutside={this.closeFilterOptions}
      >
        <div className="filter-popover-header">
          <h3 id="commits-filter-header">
            {__DARWIN__ ? 'Advanced Filters' : 'Advanced filters'}
          </h3>
          <button
            className="close"
            onClick={this.closeFilterOptions}
            aria-label="Close"
          >
            <Octicon symbol={octicons.x} />
          </button>
        </div>

        {this.renderAdvancedFilters(filter)}

        {filtersActive ? (
          <div className="filter-options-footer">
            <Button onClick={this.onClearFilters}>
              {__DARWIN__ ? 'Clear Filters' : 'Clear filters'}
            </Button>
          </div>
        ) : null}
      </Popover>
    )
  }

  private renderFilterBar(
    filter: ICommitFilter,
    filtersActive: boolean,
    advancedCount: number,
    matchingCount: number,
    totalCount: number
  ) {
    const messageText = filter.messageTerms.join(' ')
    const hasAdvancedFilters = advancedCount > 0

    return (
      <>
        <div className="filter-box-container">
          <Button
            className={classNames('filter-button', {
              active: hasAdvancedFilters,
            })}
            onClick={this.toggleFilterOptionsOpen}
            ariaExpanded={this.state.isFilterOptionsOpen}
            onButtonRef={(ref: any) => (this.filterButtonRef = ref)}
            tooltip={__DARWIN__ ? 'Filter Options' : 'Filter options'}
            ariaLabel={__DARWIN__ ? 'Filter Options' : 'Filter options'}
          >
            <span>
              <Octicon symbol={octicons.filter} />
            </span>
            {hasAdvancedFilters ? (
              <span className="active-badge">
                <div className="badge-bg">
                  <div className="badge"></div>
                </div>
              </span>
            ) : null}
          </Button>

          <TextBox
            className="commits-filter-field"
            placeholder={__DARWIN__ ? 'Filter by Message' : 'Filter by message'}
            ariaLabel={__DARWIN__ ? 'Filter by Message' : 'Filter by message'}
            value={messageText}
            displayClearButton={messageText.length > 0}
            onValueChanged={this.onMessageTextChanged}
          />
        </div>

        {this.state.isFilterOptionsOpen
          ? this.renderFilterPopover(filter)
          : null}

        <div className="commits-filter-row commits-filter-summary">
          <span className="commits-filter-count" aria-live="polite">
            {filtersActive
              ? `${matchingCount} of ${totalCount} commits`
              : `${totalCount} commits`}
          </span>
        </div>
      </>
    )
  }

  public render() {
    const {
      compareState,
      commitLookup,
      localCommitSHAs,
      commitSelection,
      localTags,
      tagsToPush,
      remote,
      multiCommitOperationState,
    } = this.props.state

    const commits: any[] = []
    for (const sha of compareState.commitSHAs) {
      const commit = commitLookup.get(sha)
      if (commit !== undefined) {
        commits.push(commit)
      }
    }

    const filter = this.state.filter
    const filtersActive = !isEmptyCommitFilter(filter)
    const matchingCommits = filterCommits(commits, filter)
    const matchingSHAs = matchingCommits.map((c: any) => c.sha)
    this.cachedAuthors = getCommitAuthors(commits)
    const advancedCount = this.countAdvancedFilters(filter)

    const emptyListMessage = filtersActive
      ? ((
          <div className="commits-filter-empty">
            <Octicon
              className="commits-filter-empty-icon"
              symbol={octicons.search}
            />
            <h2>No commits match your filters</h2>
            <p>Try adjusting or clearing your filters.</p>
            <Button
              className="commits-filter-empty-action"
              onClick={this.onClearFilters}
            >
              {__DARWIN__ ? 'Clear Filters' : 'Clear filters'}
            </Button>
          </div>
        ) as any)
      : 'No history'

    const dispatcher = this.props.dispatcher
    const repository = this.props.repository

    return (
      <div
        id="commits-view"
        role="tabpanel"
        aria-labelledby="extension-tab-commits-filter"
      >
        {this.renderFilterBar(
          filter,
          filtersActive,
          advancedCount,
          matchingCommits.length,
          commits.length
        )}

        <div className="commits-commit-list">
          <CommitList
            ref={this.commitListRef}
            gitHubRepository={repository.gitHubRepository}
            isLocalRepository={remote === null}
            commitLookup={commitLookup}
            commitSHAs={matchingSHAs}
            selectedSHAs={commitSelection.shas}
            shasToHighlight={compareState.shasToHighlight}
            localCommitSHAs={localCommitSHAs}
            canResetToCommits={true}
            canUndoCommits={true}
            canAmendCommits={true}
            emoji={this.props.emoji}
            reorderingEnabled={false}
            disableReordering={true}
            onViewCommitOnGitHub={this.props.onViewCommitOnGitHub}
            onUndoCommit={(commit: any) => dispatcher.undoCommit(repository, commit)}
            onResetToCommit={(commit: any) =>
              dispatcher.resetToCommit(repository, commit)
            }
            onRevertCommit={this.props.onRevertCommit}
            onAmendCommit={this.props.onAmendCommit}
            onCommitsSelected={this.onCommitsSelected}
            onScroll={this.onScroll}
            onCreateBranch={(commit: any) =>
              dispatcher.showPopup({
                type: PopupType.CreateBranch,
                repository,
                targetCommit: commit,
              })
            }
            onCheckoutCommit={(commit: any) => {
              if (!this.props.askForConfirmationOnCheckoutCommit) {
                dispatcher.checkoutCommit(repository, commit)
              } else {
                dispatcher.showPopup({
                  type: PopupType.ConfirmCheckoutCommit,
                  commit,
                  repository,
                })
              }
            }}
            onCreateTag={(targetCommitSha: string) =>
              dispatcher.showCreateTagDialog(
                repository,
                targetCommitSha,
                localTags
              )
            }
            onDeleteTag={(tagName: string) =>
              dispatcher.showDeleteTagDialog(repository, tagName)
            }
            onCherryPick={(commitsToPick: any) =>
              this.props.onCherryPick(repository, commitsToPick)
            }
            emptyListMessage={emptyListMessage}
            tagsToPush={tagsToPush ?? []}
            disableSquashing={true}
            isMultiCommitOperationInProgress={multiCommitOperationState !== null}
            accounts={this.props.accounts}
            preferAbsoluteDates={this.props.preferAbsoluteDates}
          />
        </div>
      </div>
    )
  }
}
