import { React } from './ghd'

/** Runtime platform flag (the host injects __DARWIN__ only at build time). */
const __DARWIN__ = (globalThis as any).__GHD_EXTENSION_API__.isDarwin

/** Tiny className joiner (supports strings and {cls: bool} objects). */
function cx(
  ...parts: Array<string | false | null | undefined | Record<string, boolean | undefined>>
): string {
  const out: string[] = []
  for (const part of parts) {
    if (typeof part === 'string') {
      out.push(part)
    } else if (part && typeof part === 'object') {
      for (const key of Object.keys(part)) {
        if (part[key]) {
          out.push(key)
        }
      }
    } else if (part) {
      out.push(String(part))
    }
  }
  return out.join(' ')
}
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

/** If we're within this many rows from the bottom, load the next history batch. */
const CloseToBottomThreshold = 10

const AllAuthorsValue = ''

interface ICommitsSidebarState {
  readonly filter: ICommitFilter
  readonly expanded: boolean
}

/**
 * The "Commits" section: the history commit list of the current branch,
 * extended with client-side filtering (author / message / description /
 * author date range). Uses the host's own CommitList so selection, context
 * menus, keyboard navigation and pagination behave exactly like History.
 */
export class CommitsSidebar extends React.Component<any, ICommitsSidebarState> {
  private readonly commitListRef = { current: null }
  private loadChangedFilesTimer: any = null
  private loadingMoreCommitsPromise: Promise<void> | null = null

  public constructor(props: any) {
    super(props)

    this.state = { filter: EmptyCommitFilter, expanded: false }
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

  private onToggleExpanded = () => {
    this.setState((prevState: any) => ({ expanded: !prevState.expanded }))
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

  private renderAdvancedFilters(
    authors: ReadonlyArray<any>,
    filter: ICommitFilter
  ) {
    const dateFromInvalid =
      filter.dateFrom !== null && !isValidDateString(filter.dateFrom)
    const dateToInvalid =
      filter.dateTo !== null && !isValidDateString(filter.dateTo)

    return (
      <>
        <TextBox
          className="commits-filter-field"
          placeholder={__DARWIN__ ? 'Filter by Description' : 'Filter by description'}
          ariaLabel={__DARWIN__ ? 'Filter by Description' : 'Filter by description'}
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
            {authors.map((author: any) => (
              <option key={author.email} value={author.email}>
                {author.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="commits-filter-row commits-filter-dates">
          <TextBox
            className={cx('commits-filter-date-field', {
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
            className={cx('commits-filter-date-field', {
              'invalid-date': dateToInvalid,
            })}
            placeholder="YYYY-MM-DD"
            ariaLabel="To date"
            value={filter.dateTo ?? ''}
            onValueChanged={this.onDateToChanged}
          />
        </div>

        {/* Always rendered (reserved height) so that fixing the date does
            not make the list jump. */}
        <div
          className={cx('commits-filter-date-hint', {
            visible: dateFromInvalid || dateToInvalid,
          })}
          role="alert"
        >
          {__DARWIN__ ? 'Invalid Date' : 'Invalid date'} — YYYY-MM-DD
        </div>
      </>
    )
  }

  private renderFilterBar(
    authors: ReadonlyArray<any>,
    filter: ICommitFilter,
    filtersActive: boolean,
    hiddenFiltersActive: boolean,
    matchingCount: number,
    totalCount: number
  ) {
    const messageText = filter.messageTerms.join(' ')
    const { expanded } = this.state

    return (
      <div className="commits-filter">
        <div className="commits-filter-row commits-filter-primary">
          <Button
            className={cx('commits-filter-toggle', {
              selected: hiddenFiltersActive && !expanded,
            })}
            ariaExpanded={expanded}
            tooltip={
              expanded
                ? __DARWIN__
                  ? 'Hide Advanced Filters'
                  : 'Hide advanced filters'
                : __DARWIN__
                  ? 'Show Advanced Filters'
                  : 'Show advanced filters'
            }
            onClick={this.onToggleExpanded}
          >
            <Octicon
              symbol={
                expanded
                  ? octicons.chevronUp
                  : hiddenFiltersActive
                    ? octicons.filter
                    : octicons.chevronDown
              }
            />
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

        {expanded ? this.renderAdvancedFilters(authors, filter) : null}

        <div className="commits-filter-row commits-filter-summary">
          <span className="commits-filter-count" aria-live="polite">
            {filtersActive
              ? `${matchingCount} of ${totalCount} commits`
              : `${totalCount} commits`}
          </span>
          {filtersActive ? (
            <Button
              className="commits-filter-clear-button"
              onClick={this.onClearFilters}
            >
              {__DARWIN__ ? 'Clear Filters' : 'Clear filters'}
            </Button>
          ) : null}
        </div>
      </div>
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
    const authors = getCommitAuthors(commits)

    const hiddenFiltersActive =
      filtersActive &&
      !this.state.expanded &&
      (filter.authorEmails.length > 0 ||
        filter.descriptionTerm.trim().length > 0 ||
        filter.dateFrom !== null ||
        filter.dateTo !== null)

    const emptyListMessage = filtersActive
      ? ((
          <div className="commits-filter-empty">
            <Octicon className="commits-filter-empty-icon" symbol={octicons.search} />
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
          authors,
          filter,
          filtersActive,
          hiddenFiltersActive,
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
              dispatcher.showCreateTagDialog(repository, targetCommitSha, localTags)
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
