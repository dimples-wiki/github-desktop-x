import * as React from 'react'
import classNames from 'classnames'

import { Commit, ICommitContext } from '../../models/commit'
import { CommitList } from './commit-list'
import { defaultErrorHandler } from '../dispatcher'
import { TextBox } from '../lib/text-box'
import { Select } from '../lib/select'
import { Button } from '../lib/button'
import { PopupType } from '../../models/popup'
import { ThrottledScheduler } from '../lib/throttled-scheduler'
import { formatNumber } from '../../lib/format-number'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { getUniqueCoauthorsAsAuthors } from '../../lib/unique-coauthors-as-authors'
import { getSquashedCommitDescription } from '../../lib/squash/squashed-commit-description'
import { doMergeCommitsExistAfterCommit } from '../../lib/git'
import { IRepositorySectionContext } from '../../lib/extensions/extension-points'
import {
  EmptyCommitFilter,
  ICommitFilter,
  filterCommits,
  getCommitAuthors,
  isEmptyCommitFilter,
  isValidDateString,
} from './commits-filter-logic'

interface ICommitsSidebarState {
  /** The filter currently applied to the commit list. */
  readonly filter: ICommitFilter

  /**
   * Whether the advanced filters (description, author, date range) are
   * expanded. Collapsed by default so the tab leads with a single search box.
   */
  readonly expanded: boolean
}

/** If we're within this many rows from the bottom, load the next history batch. */
const CloseToBottomThreshold = 10

const AllAuthorsValue = ''

/**
 * The "Commits" repository section extension: the history commit list of the
 * current branch, extended with client-side filtering (by author, commit
 * message, description, and author date range).
 *
 * The list itself is the very same `CommitList` used by the History tab, so
 * selection, context menus, keyboard navigation and pagination behave exactly
 * like they do there.
 */
export class CommitsSidebar extends React.Component<
  IRepositorySectionContext,
  ICommitsSidebarState
> {
  private readonly commitListRef = React.createRef<CommitList>()
  private readonly loadChangedFilesScheduler = new ThrottledScheduler(200)
  private loadingMoreCommitsPromise: Promise<void> | null = null

  public constructor(props: IRepositorySectionContext) {
    super(props)

    this.state = { filter: EmptyCommitFilter, expanded: false }
  }

  public componentWillMount() {
    // Make sure the compare state (i.e. the commits of the current branch)
    // is initialized even when the user jumps straight to this tab.
    this.props.dispatcher.initializeCompare(this.props.repository)
  }

  /** Focuses the commit list (used by the "Show Commits" menu accelerator). */
  public focus() {
    this.commitListRef.current?.focus()
  }

  private onToggleExpanded = () => {
    this.setState(prevState => ({ expanded: !prevState.expanded }))
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

  private onSquash = async (
    toSquash: ReadonlyArray<Commit>,
    squashOnto: Commit,
    lastRetainedCommitRef: string | null,
    isInvokedByContextMenu: boolean
  ) => {
    const toSquashSansSquashOnto = toSquash.filter(
      c => c.sha !== squashOnto.sha
    )

    const allCommitsInSquash = [...toSquashSansSquashOnto, squashOnto]
    const coAuthors = getUniqueCoauthorsAsAuthors(allCommitsInSquash)

    const squashedDescription = getSquashedCommitDescription(
      toSquashSansSquashOnto,
      squashOnto
    )

    if (
      await doMergeCommitsExistAfterCommit(
        this.props.repository,
        lastRetainedCommitRef
      )
    ) {
      defaultErrorHandler(
        new Error(
          `Unable to squash. Squashing replays all commits up to the last one required for the squash. A merge commit cannot exist among those commits.`
        ),
        this.props.dispatcher
      )
      return
    }

    this.props.dispatcher.recordSquashInvoked(isInvokedByContextMenu)

    this.props.dispatcher.showPopup({
      type: PopupType.CommitMessage,
      repository: this.props.repository,
      coAuthors,
      showCoAuthoredBy: coAuthors.length > 0,
      commitMessage: {
        summary: squashOnto.summary,
        description: squashedDescription,
        timestamp: Date.now(),
      },
      dialogTitle: `Squash ${allCommitsInSquash.length} Commits`,
      dialogButtonText: `Squash ${allCommitsInSquash.length} Commits`,
      prepopulateCommitSummary: true,
      onSubmitCommitMessage: async (context: ICommitContext) => {
        this.props.dispatcher.closePopup(PopupType.CommitMessage)

        this.props.dispatcher.squash(
          this.props.repository,
          toSquashSansSquashOnto,
          squashOnto,
          lastRetainedCommitRef,
          context
        )
        return true
      },
    })
  }

  private renderAdvancedFilters(
    authors: ReadonlyArray<{ name: string; email: string }>,
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

        {/* Always rendered (reserved height) so that fixing the date does
            not make the list jump. */}
        <div
          className={classNames('commits-filter-date-hint', {
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
    authors: ReadonlyArray<{ name: string; email: string }>,
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
            className={classNames('commits-filter-toggle', {
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
              symbol={expanded ? octicons.chevronUp : octicons.chevronDown}
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

    // Filters that are collapsed right now but still narrowing the list.
    const hiddenFiltersActive =
      filtersActive &&
      !this.state.expanded &&
      (filter.authorEmails.length > 0 ||
        filter.descriptionTerm.trim().length > 0 ||
        filter.dateFrom !== null ||
        filter.dateTo !== null)

    // Follows the native blankslate pattern (icon + title + description +
    // action) used by e.g. the Changes interstitial.
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
        ) as JSX.Element)
      : 'No history'

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
              this.props.dispatcher.resetToCommit(this.props.repository, commit)
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
            onSquash={this.onSquash}
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
