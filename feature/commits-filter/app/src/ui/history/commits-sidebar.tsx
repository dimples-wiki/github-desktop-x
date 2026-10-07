import * as React from 'react'

import { Commit, CommitOneLine } from '../../models/commit'
import { IRepositoryState } from '../../lib/app-state'
import { CommitList } from './commit-list'
import { Repository } from '../../models/repository'
import { Dispatcher } from '../dispatcher'
import { TextBox } from '../lib/text-box'
import { Select } from '../lib/select'
import { Button } from '../lib/button'
import { Account } from '../../models/account'
import { PopupType } from '../../models/popup'
import { Emoji } from '../../lib/emoji'
import { ThrottledScheduler } from '../lib/throttled-scheduler'
import { formatNumber } from '../../lib/format-number'
import {
  EmptyCommitFilter,
  ICommitFilter,
  filterCommits,
  getCommitAuthors,
  isEmptyCommitFilter,
  isValidDateString,
} from './commits-filter-logic'

interface ICommitsSidebarProps {
  readonly repository: Repository

  /** The full repository state; the commit data is shared with History. */
  readonly state: IRepositoryState

  readonly dispatcher: Dispatcher
  readonly emoji: Map<string, Emoji>
  readonly accounts: ReadonlyArray<Account>

  readonly onRevertCommit: (commit: Commit) => void
  readonly onAmendCommit: (commit: Commit, isLocalCommit: boolean) => void
  readonly onViewCommitOnGitHub: (sha: string) => void
  readonly onCherryPick: (
    repository: Repository,
    commits: ReadonlyArray<CommitOneLine>
  ) => void

  readonly askForConfirmationOnCheckoutCommit: boolean
  readonly preferAbsoluteDates: boolean
}

interface ICommitsSidebarState {
  /** The filter currently applied to the commit list. */
  readonly filter: ICommitFilter
}

/** If we're within this many rows from the bottom, load the next history batch. */
const CloseToBottomThreshold = 10

const AllAuthorsValue = ''

/**
 * The sidebar of the Commits tab: the history commit list of the current
 * branch, extended with client-side filtering (by author, commit message,
 * description, and author date range).
 *
 * The list itself is the very same `CommitList` used by the History tab, so
 * selection, context menus, keyboard navigation and pagination behave exactly
 * like they do there.
 */
export class CommitsSidebar extends React.Component<
  ICommitsSidebarProps,
  ICommitsSidebarState
> {
  private readonly commitListRef = React.createRef<CommitList>()
  private readonly loadChangedFilesScheduler = new ThrottledScheduler(200)
  private loadingMoreCommitsPromise: Promise<void> | null = null

  public constructor(props: ICommitsSidebarProps) {
    super(props)

    this.state = { filter: EmptyCommitFilter }
  }

  public componentWillMount() {
    // Make sure the compare state (i.e. the commits of the current branch)
    // is initialized even when the user jumps straight to this tab.
    this.props.dispatcher.initializeCompare(this.props.repository)
  }

  public focusCommits() {
    this.commitListRef.current?.focus()
  }

  private onFilterChanged = (update: Partial<ICommitFilter>) => {
    this.setState(prevState => ({
      filter: { ...prevState.filter, ...update },
    }))
  }

  private onMessageTextChanged = (value: string) => {
    this.onFilterChanged({
      messageTerms: value
        .split(/\s+/)
        .map(term => term.trim())
        .filter(term => term.length > 0),
    })
  }

  private onDescriptionTextChanged = (value: string) => {
    this.onFilterChanged({ descriptionTerm: value })
  }

  private onAuthorChanged = (event: React.FormEvent<HTMLSelectElement>) => {
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

  private onCommitsSelected = (
    commits: ReadonlyArray<Commit>,
    isContiguous: boolean
  ) => {
    this.props.dispatcher.changeCommitSelection(
      this.props.repository,
      commits.map(c => c.sha),
      isContiguous
    )

    this.loadChangedFilesScheduler.queue(() => {
      this.props.dispatcher.loadChangedFilesForCurrentSelection(
        this.props.repository
      )
    })
  }

  private onScroll = (start: number, end: number) => {
    const { commitSHAs } = this.props.state.compareState

    if (commitSHAs.length - end <= CloseToBottomThreshold) {
      if (this.loadingMoreCommitsPromise != null) {
        // as this callback fires for any scroll event we need to guard
        // against re-entrant calls to loadCommitBatch
        return
      }

      this.loadingMoreCommitsPromise = this.props.dispatcher
        .loadNextCommitBatch(this.props.repository)
        .then(() => {
          // deferring unsetting this flag to some time _after_ the commits
          // have been appended to prevent eagerly adding more commits due
          // to scroll events (which fire indiscriminately)
          window.setTimeout(() => {
            this.loadingMoreCommitsPromise = null
          }, 500)
        })
    }
  }

  private renderFilterBar(
    authors: ReadonlyArray<{ name: string; email: string }>,
    filter: ICommitFilter,
    filtersActive: boolean,
    matchingCount: number,
    totalCount: number
  ) {
    const messageText = filter.messageTerms.join(' ')

    return (
      <div className="commits-filter">
        <TextBox
          type="search"
          className="commits-filter-field"
          placeholder={__DARWIN__ ? 'Filter by Message' : 'Filter by message'}
          ariaLabel={__DARWIN__ ? 'Filter by Message' : 'Filter by message'}
          value={messageText}
          displayClearButton={messageText.length > 0}
          onValueChanged={this.onMessageTextChanged}
        />

        <TextBox
          type="search"
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
            {authors.map(author => (
              <option key={author.email} value={author.email}>
                {author.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="commits-filter-row commits-filter-dates">
          <TextBox
            className="commits-filter-date-field"
            placeholder="YYYY-MM-DD"
            ariaLabel="From date"
            value={filter.dateFrom ?? ''}
            displayInvalidState={
              filter.dateFrom !== null && !isValidDateString(filter.dateFrom)
            }
            onValueChanged={this.onDateFromChanged}
          />
          <span className="commits-filter-dates-separator" aria-hidden="true">
            –
          </span>
          <TextBox
            className="commits-filter-date-field"
            placeholder="YYYY-MM-DD"
            ariaLabel="To date"
            value={filter.dateTo ?? ''}
            displayInvalidState={
              filter.dateTo !== null && !isValidDateString(filter.dateTo)
            }
            onValueChanged={this.onDateToChanged}
          />
        </div>

        <div className="commits-filter-row commits-filter-summary">
          <span className="commits-filter-count" aria-live="polite">
            {filtersActive
              ? `${formatNumber(matchingCount)} of ${formatNumber(
                  totalCount
                )} commits`
              : `${formatNumber(totalCount)} commits`}
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

    const commits: Commit[] = []
    for (const sha of compareState.commitSHAs) {
      const commit = commitLookup.get(sha)
      if (commit !== undefined) {
        commits.push(commit)
      }
    }

    const filter = this.state.filter
    const filtersActive = !isEmptyCommitFilter(filter)
    const matchingCommits = filterCommits(commits, filter)
    const matchingSHAs = matchingCommits.map(c => c.sha)
    const authors = getCommitAuthors(commits)

    const emptyListMessage = filtersActive
      ? 'No commits match your filters'
      : 'No history'

    return (
      <div id="commits-view" role="tabpanel" aria-labelledby="commits-tab">
        {this.renderFilterBar(
          authors,
          filter,
          filtersActive,
          matchingCommits.length,
          commits.length
        )}

        <div className="commits-commit-list">
          <CommitList
            ref={this.commitListRef}
            gitHubRepository={this.props.repository.gitHubRepository}
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
            onUndoCommit={commit =>
              this.props.dispatcher.undoCommit(this.props.repository, commit)
            }
            onResetToCommit={commit =>
              this.props.dispatcher.resetToCommit(
                this.props.repository,
                commit
              )
            }
            onRevertCommit={this.props.onRevertCommit}
            onAmendCommit={this.props.onAmendCommit}
            onCommitsSelected={this.onCommitsSelected}
            onScroll={this.onScroll}
            onCreateBranch={commit =>
              this.props.dispatcher.showPopup({
                type: PopupType.CreateBranch,
                repository: this.props.repository,
                targetCommit: commit,
              })
            }
            onCheckoutCommit={commit => {
              if (!this.props.askForConfirmationOnCheckoutCommit) {
                this.props.dispatcher.checkoutCommit(
                  this.props.repository,
                  commit
                )
              } else {
                this.props.dispatcher.showPopup({
                  type: PopupType.ConfirmCheckoutCommit,
                  commit: commit,
                  repository: this.props.repository,
                })
              }
            }}
            onCreateTag={targetCommitSha =>
              this.props.dispatcher.showCreateTagDialog(
                this.props.repository,
                targetCommitSha,
                localTags
              )
            }
            onDeleteTag={tagName =>
              this.props.dispatcher.showDeleteTagDialog(
                this.props.repository,
                tagName
              )
            }
            onCherryPick={commits =>
              this.props.onCherryPick(this.props.repository, commits)
            }
            emptyListMessage={emptyListMessage}
            tagsToPush={tagsToPush ?? []}
            disableSquashing={false}
            isMultiCommitOperationInProgress={
              multiCommitOperationState !== null
            }
            accounts={this.props.accounts}
            preferAbsoluteDates={this.props.preferAbsoluteDates}
          />
        </div>
      </div>
    )
  }
}
