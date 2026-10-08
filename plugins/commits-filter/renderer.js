(() => {
  // plugins/commits-filter/src/ghd.ts
  var api = globalThis.__GHD_EXTENSION_API__;
  var React = api.React;
  var classNames = api.classNames;
  var components = api.components;
  var octicons = api.octicons;
  var PopupType = api.PopupType;
  var Popover = api.Popover;
  var PopoverAnchorPosition = api.PopoverAnchorPosition;
  var PopoverDecoration = api.PopoverDecoration;
  var defaultErrorHandler = api.defaultErrorHandler;
  var registerRepositorySection = api.registerRepositorySection;
  var registerChangesFileView = api.registerChangesFileView;

  // plugins/commits-filter/src/commits-filter-logic.ts
  var EmptyCommitFilter = {
    authorEmails: [],
    messageTerms: [],
    descriptionTerm: "",
    dateFrom: null,
    dateTo: null
  };
  function isEmptyCommitFilter(filter) {
    return filter.authorEmails.length === 0 && filter.messageTerms.length === 0 && filter.descriptionTerm.trim().length === 0 && filter.dateFrom === null && filter.dateTo === null;
  }
  function parseDateString(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (match === null) {
      return null;
    }
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return null;
    }
    return date;
  }
  function isValidDateString(value) {
    return value.trim().length === 0 || parseDateString(value) !== null;
  }
  function getCommitAuthors(commits) {
    const authorsByEmail = /* @__PURE__ */ new Map();
    for (const commit of commits) {
      const email = commit.author.email.toLowerCase();
      if (!authorsByEmail.has(email)) {
        authorsByEmail.set(email, { name: commit.author.name, email });
      }
    }
    return [...authorsByEmail.values()].sort(
      (a, b) => a.name.localeCompare(b.name, void 0, { sensitivity: "base" })
    );
  }
  function startOfDay(date) {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      0,
      0,
      0,
      0
    ).getTime();
  }
  function endOfDay(date) {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      23,
      59,
      59,
      999
    ).getTime();
  }
  function matchesDateRange(commit, from, to) {
    const timestamp = commit.author.date.getTime();
    if (from !== null && timestamp < startOfDay(from)) {
      return false;
    }
    if (to !== null && timestamp > endOfDay(to)) {
      return false;
    }
    return true;
  }
  function matchesAllTerms(haystack, terms) {
    const lowered = haystack.toLowerCase();
    return terms.every((term) => lowered.includes(term.toLowerCase()));
  }
  function filterCommits(commits, filter) {
    const descriptionTerm = filter.descriptionTerm.trim().toLowerCase();
    const authorEmails = filter.authorEmails.map((email) => email.toLowerCase());
    const dateFrom = filter.dateFrom !== null ? parseDateString(filter.dateFrom) : null;
    const dateTo = filter.dateTo !== null ? parseDateString(filter.dateTo) : null;
    return commits.filter((commit) => {
      if (authorEmails.length > 0 && !authorEmails.includes(commit.author.email.toLowerCase())) {
        return false;
      }
      if (filter.messageTerms.length > 0 && !matchesAllTerms(commit.summary, filter.messageTerms)) {
        return false;
      }
      if (descriptionTerm.length > 0 && !String(commit.body ?? "").toLowerCase().includes(descriptionTerm)) {
        return false;
      }
      if (!matchesDateRange(commit, dateFrom, dateTo)) {
        return false;
      }
      return true;
    });
  }

  // plugins/commits-filter/src/commits-sidebar.tsx
  var { CommitList, TextBox, Select, Button, Octicon } = globalThis.__GHD_EXTENSION_API__.components;
  var octicons2 = globalThis.__GHD_EXTENSION_API__.octicons;
  var PopupType2 = globalThis.__GHD_EXTENSION_API__.PopupType;
  var __DARWIN__ = globalThis.__GHD_EXTENSION_API__.isDarwin;
  var CloseToBottomThreshold = 10;
  var AllAuthorsValue = "";
  var CommitsSidebar = class extends React.Component {
    commitListRef = { current: null };
    filterButtonRef = null;
    loadChangedFilesTimer = null;
    loadingMoreCommitsPromise = null;
    /** Authors of the currently loaded commits (render scope cache). */
    cachedAuthors = [];
    constructor(props) {
      super(props);
      this.state = {
        filter: EmptyCommitFilter,
        isFilterOptionsOpen: false
      };
    }
    componentWillMount() {
      this.props.dispatcher.initializeCompare(this.props.repository);
    }
    /** Focuses the commit list (used by the "Show Commits" menu accelerator). */
    focus() {
      ;
      this.commitListRef.current?.focus();
    }
    toggleFilterOptionsOpen = () => {
      this.setState((prevState) => ({
        isFilterOptionsOpen: !prevState.isFilterOptionsOpen
      }));
    };
    closeFilterOptions = () => {
      if (this.state.isFilterOptionsOpen) {
        this.setState({ isFilterOptionsOpen: false });
      }
    };
    onFilterChanged = (update) => {
      this.setState((prevState) => ({
        filter: { ...prevState.filter, ...update }
      }));
    };
    onMessageTextChanged = (value) => {
      this.onFilterChanged({
        messageTerms: value.split(/\s+/).map((term) => term.trim()).filter((term) => term.length > 0)
      });
    };
    onDescriptionTextChanged = (value) => {
      this.onFilterChanged({ descriptionTerm: value });
    };
    onAuthorChanged = (event) => {
      const email = event.currentTarget.value;
      this.onFilterChanged({ authorEmails: email === "" ? [] : [email] });
    };
    onDateFromChanged = (value) => {
      this.onFilterChanged({ dateFrom: value.trim().length === 0 ? null : value });
    };
    onDateToChanged = (value) => {
      this.onFilterChanged({ dateTo: value.trim().length === 0 ? null : value });
    };
    onClearFilters = () => {
      this.setState({ filter: EmptyCommitFilter });
    };
    onCommitsSelected = (commits, isContiguous) => {
      this.props.dispatcher.changeCommitSelection(
        this.props.repository,
        commits.map((c) => c.sha),
        isContiguous
      );
      if (this.loadChangedFilesTimer !== null) {
        clearTimeout(this.loadChangedFilesTimer);
      }
      this.loadChangedFilesTimer = setTimeout(() => {
        this.loadChangedFilesTimer = null;
        this.props.dispatcher.loadChangedFilesForCurrentSelection(
          this.props.repository
        );
      }, 200);
    };
    onScroll = (start, end) => {
      const { commitSHAs } = this.props.state.compareState;
      if (commitSHAs.length - end <= CloseToBottomThreshold) {
        if (this.loadingMoreCommitsPromise != null) {
          return;
        }
        this.loadingMoreCommitsPromise = this.props.dispatcher.loadNextCommitBatch(this.props.repository).then(() => {
          window.setTimeout(() => {
            this.loadingMoreCommitsPromise = null;
          }, 500);
        });
      }
    };
    /** The number of advanced-filter dimensions currently active. */
    countAdvancedFilters(filter) {
      let count = 0;
      if (filter.authorEmails.length > 0) {
        count++;
      }
      if (filter.descriptionTerm.trim().length > 0) {
        count++;
      }
      if (filter.dateFrom !== null) {
        count++;
      }
      if (filter.dateTo !== null) {
        count++;
      }
      return count;
    }
    renderAdvancedFilters(filter) {
      const dateFromInvalid = filter.dateFrom !== null && !isValidDateString(filter.dateFrom);
      const dateToInvalid = filter.dateTo !== null && !isValidDateString(filter.dateTo);
      return /* @__PURE__ */ React.createElement("div", { className: "commits-filter-options" }, /* @__PURE__ */ React.createElement(
        TextBox,
        {
          className: "commits-filter-field",
          placeholder: __DARWIN__ ? "Filter by Description" : "Filter by description",
          ariaLabel: __DARWIN__ ? "Filter by Description" : "Filter by description",
          value: filter.descriptionTerm,
          displayClearButton: filter.descriptionTerm.length > 0,
          onValueChanged: this.onDescriptionTextChanged
        }
      ), /* @__PURE__ */ React.createElement("div", { className: "commits-filter-row" }, /* @__PURE__ */ React.createElement(
        Select,
        {
          className: "commits-filter-author",
          value: filter.authorEmails[0] ?? AllAuthorsValue,
          onChange: this.onAuthorChanged
        },
        /* @__PURE__ */ React.createElement("option", { value: AllAuthorsValue }, __DARWIN__ ? "All Authors" : "All authors"),
        this.cachedAuthors.map((author) => /* @__PURE__ */ React.createElement("option", { key: author.email, value: author.email }, author.name))
      )), /* @__PURE__ */ React.createElement("div", { className: "commits-filter-row commits-filter-dates" }, /* @__PURE__ */ React.createElement(
        TextBox,
        {
          className: classNames("commits-filter-date-field", {
            "invalid-date": dateFromInvalid
          }),
          placeholder: "YYYY-MM-DD",
          ariaLabel: "From date",
          value: filter.dateFrom ?? "",
          onValueChanged: this.onDateFromChanged
        }
      ), /* @__PURE__ */ React.createElement("span", { className: "commits-filter-dates-separator", "aria-hidden": "true" }, "\u2013"), /* @__PURE__ */ React.createElement(
        TextBox,
        {
          className: classNames("commits-filter-date-field", {
            "invalid-date": dateToInvalid
          }),
          placeholder: "YYYY-MM-DD",
          ariaLabel: "To date",
          value: filter.dateTo ?? "",
          onValueChanged: this.onDateToChanged
        }
      )), /* @__PURE__ */ React.createElement(
        "div",
        {
          className: classNames("commits-filter-date-hint", {
            visible: dateFromInvalid || dateToInvalid
          }),
          role: "alert"
        },
        __DARWIN__ ? "Invalid Date" : "Invalid date",
        " \u2014 YYYY-MM-DD"
      ));
    }
    renderFilterPopover(filter) {
      const filtersActive = !isEmptyCommitFilter(filter);
      return /* @__PURE__ */ React.createElement(
        Popover,
        {
          className: "filter-popover commits-filter-popover",
          ariaLabelledby: "commits-filter-header",
          anchor: this.filterButtonRef,
          anchorPosition: PopoverAnchorPosition.BottomRight,
          decoration: PopoverDecoration.Balloon,
          onMousedownOutside: this.closeFilterOptions,
          onClickOutside: this.closeFilterOptions
        },
        /* @__PURE__ */ React.createElement("div", { className: "filter-popover-header" }, /* @__PURE__ */ React.createElement("h3", { id: "commits-filter-header" }, __DARWIN__ ? "Advanced Filters" : "Advanced filters"), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "close",
            onClick: this.closeFilterOptions,
            "aria-label": "Close"
          },
          /* @__PURE__ */ React.createElement(Octicon, { symbol: octicons2.x })
        )),
        this.renderAdvancedFilters(filter),
        filtersActive ? /* @__PURE__ */ React.createElement("div", { className: "filter-options-footer" }, /* @__PURE__ */ React.createElement(Button, { onClick: this.onClearFilters }, __DARWIN__ ? "Clear Filters" : "Clear filters")) : null
      );
    }
    renderFilterBar(filter, filtersActive, advancedCount, matchingCount, totalCount) {
      const messageText = filter.messageTerms.join(" ");
      const hasAdvancedFilters = advancedCount > 0;
      return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "filter-box-container" }, /* @__PURE__ */ React.createElement(
        Button,
        {
          className: classNames("filter-button", {
            active: hasAdvancedFilters
          }),
          onClick: this.toggleFilterOptionsOpen,
          ariaExpanded: this.state.isFilterOptionsOpen,
          onButtonRef: (ref) => this.filterButtonRef = ref,
          tooltip: __DARWIN__ ? "Filter Options" : "Filter options",
          ariaLabel: __DARWIN__ ? "Filter Options" : "Filter options"
        },
        /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement(Octicon, { symbol: octicons2.filter })),
        hasAdvancedFilters ? /* @__PURE__ */ React.createElement("span", { className: "active-badge" }, /* @__PURE__ */ React.createElement("div", { className: "badge-bg" }, /* @__PURE__ */ React.createElement("div", { className: "badge" }))) : null
      ), /* @__PURE__ */ React.createElement(
        TextBox,
        {
          className: "commits-filter-field",
          placeholder: __DARWIN__ ? "Filter by Message" : "Filter by message",
          ariaLabel: __DARWIN__ ? "Filter by Message" : "Filter by message",
          value: messageText,
          displayClearButton: messageText.length > 0,
          onValueChanged: this.onMessageTextChanged
        }
      )), this.state.isFilterOptionsOpen ? this.renderFilterPopover(filter) : null, /* @__PURE__ */ React.createElement("div", { className: "commits-filter-row commits-filter-summary" }, /* @__PURE__ */ React.createElement("span", { className: "commits-filter-count", "aria-live": "polite" }, filtersActive ? `${matchingCount} of ${totalCount} commits` : `${totalCount} commits`)));
    }
    render() {
      const {
        compareState,
        commitLookup,
        localCommitSHAs,
        commitSelection,
        localTags,
        tagsToPush,
        remote,
        multiCommitOperationState
      } = this.props.state;
      const commits = [];
      for (const sha of compareState.commitSHAs) {
        const commit = commitLookup.get(sha);
        if (commit !== void 0) {
          commits.push(commit);
        }
      }
      const filter = this.state.filter;
      const filtersActive = !isEmptyCommitFilter(filter);
      const matchingCommits = filterCommits(commits, filter);
      const matchingSHAs = matchingCommits.map((c) => c.sha);
      this.cachedAuthors = getCommitAuthors(commits);
      const advancedCount = this.countAdvancedFilters(filter);
      const emptyListMessage = filtersActive ? /* @__PURE__ */ React.createElement("div", { className: "commits-filter-empty" }, /* @__PURE__ */ React.createElement(
        Octicon,
        {
          className: "commits-filter-empty-icon",
          symbol: octicons2.search
        }
      ), /* @__PURE__ */ React.createElement("h2", null, "No commits match your filters"), /* @__PURE__ */ React.createElement("p", null, "Try adjusting or clearing your filters."), /* @__PURE__ */ React.createElement(
        Button,
        {
          className: "commits-filter-empty-action",
          onClick: this.onClearFilters
        },
        __DARWIN__ ? "Clear Filters" : "Clear filters"
      )) : "No history";
      const dispatcher = this.props.dispatcher;
      const repository = this.props.repository;
      return /* @__PURE__ */ React.createElement(
        "div",
        {
          id: "commits-view",
          role: "tabpanel",
          "aria-labelledby": "extension-tab-commits-filter"
        },
        this.renderFilterBar(
          filter,
          filtersActive,
          advancedCount,
          matchingCommits.length,
          commits.length
        ),
        /* @__PURE__ */ React.createElement("div", { className: "commits-commit-list" }, /* @__PURE__ */ React.createElement(
          CommitList,
          {
            ref: this.commitListRef,
            gitHubRepository: repository.gitHubRepository,
            isLocalRepository: remote === null,
            commitLookup,
            commitSHAs: matchingSHAs,
            selectedSHAs: commitSelection.shas,
            shasToHighlight: compareState.shasToHighlight,
            localCommitSHAs,
            canResetToCommits: true,
            canUndoCommits: true,
            canAmendCommits: true,
            emoji: this.props.emoji,
            reorderingEnabled: false,
            disableReordering: true,
            onViewCommitOnGitHub: this.props.onViewCommitOnGitHub,
            onUndoCommit: (commit) => dispatcher.undoCommit(repository, commit),
            onResetToCommit: (commit) => dispatcher.resetToCommit(repository, commit),
            onRevertCommit: this.props.onRevertCommit,
            onAmendCommit: this.props.onAmendCommit,
            onCommitsSelected: this.onCommitsSelected,
            onScroll: this.onScroll,
            onCreateBranch: (commit) => dispatcher.showPopup({
              type: PopupType2.CreateBranch,
              repository,
              targetCommit: commit
            }),
            onCheckoutCommit: (commit) => {
              if (!this.props.askForConfirmationOnCheckoutCommit) {
                dispatcher.checkoutCommit(repository, commit);
              } else {
                dispatcher.showPopup({
                  type: PopupType2.ConfirmCheckoutCommit,
                  commit,
                  repository
                });
              }
            },
            onCreateTag: (targetCommitSha) => dispatcher.showCreateTagDialog(
              repository,
              targetCommitSha,
              localTags
            ),
            onDeleteTag: (tagName) => dispatcher.showDeleteTagDialog(repository, tagName),
            onCherryPick: (commitsToPick) => this.props.onCherryPick(repository, commitsToPick),
            emptyListMessage,
            tagsToPush: tagsToPush ?? [],
            disableSquashing: true,
            isMultiCommitOperationInProgress: multiCommitOperationState !== null,
            accounts: this.props.accounts,
            preferAbsoluteDates: this.props.preferAbsoluteDates
          }
        ))
      );
    }
  };

  // plugins/commits-filter/src/styles.ts
  var css = `
#commits-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
}

/* \u2500\u2500 Filter bar: joined filter-options button + message search box \u2500\u2500 */

#commits-view .filter-box-container {
  display: flex;
  align-items: center;
  background: var(--box-alt-background-color);
  padding: var(--spacing-half);
  border-bottom: var(--base-border);
  margin-bottom: 0;
}

#commits-view .filter-box-container input {
  border-radius: 0 var(--border-radius) var(--border-radius) 0;
}

#commits-view .filter-box-container .filter-button {
  border-radius: var(--border-radius) 0 0 var(--border-radius);
  border-right: none;
  font-weight: var(--font-weight-semibold);
  color: var(--text-color);
  justify-content: space-between;
  display: inline-flex;
  align-items: center;
  padding-right: var(--spacing-half);
  position: relative;
  flex: initial;
}

#commits-view .filter-box-container .filter-button.active span:first-child {
  color: var(--box-selected-active-background-color);
}

#commits-view .filter-box-container .filter-button .active-badge {
  position: absolute;
  right: 18px;
  top: 4px;
}

#commits-view .filter-box-container .filter-button .active-badge .badge-bg {
  padding: 1px;
  border-radius: 50%;
  background-color: var(--secondary-button-background);
}

#commits-view .filter-box-container .filter-button .active-badge .badge {
  width: 5px;
  height: 5px;
  background-color: var(--box-selected-active-background-color);
  border-radius: 50%;
}

#commits-view .filter-box-container .commits-filter-field {
  flex: 1;
  width: 100%;
}

/* \u2500\u2500 Summary row: match count \u2500\u2500 */

#commits-view .commits-filter-summary {
  display: flex;
  flex-direction: row;
  align-items: center;
  background: var(--box-alt-background-color);
  padding: 0 var(--spacing-half) var(--spacing-half);
}

#commits-view .commits-filter-summary .commits-filter-count {
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
  flex: 1;
}

/* \u2500\u2500 Advanced filters popover (host Popover, plugin layout) \u2500\u2500 */

#commits-view .filter-popover.commits-filter-popover,
.commits-filter-popover.filter-popover {
  text-align: left;
  min-width: 240px;
}

.commits-filter-popover .filter-popover-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.commits-filter-popover .filter-popover-header h3 {
  margin: 0;
}

.commits-filter-popover .filter-options {
  margin: var(--spacing) 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-half);
}

.commits-filter-popover .commits-filter-field {
  width: 100%;
}

.commits-filter-popover .commits-filter-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--spacing-half);
}

.commits-filter-popover .commits-filter-author {
  flex: 1;
}

.commits-filter-popover .commits-filter-author select {
  width: 100%;
}

.commits-filter-popover .commits-filter-dates .commits-filter-date-field {
  flex: 1;
  min-width: 0;
}

.commits-filter-popover .commits-filter-dates .commits-filter-date-field.invalid-date input {
  border-color: var(--error-color);
}

.commits-filter-popover .commits-filter-dates .commits-filter-date-field.invalid-date input:focus {
  border-color: var(--error-color);
  box-shadow: 0 0 0 1px rgba(248, 81, 73, 0.25);
}

.commits-filter-popover .commits-filter-dates .commits-filter-dates-separator {
  color: var(--text-secondary-color);
  flex: initial;
}

.commits-filter-popover .commits-filter-date-hint {
  color: var(--error-color);
  font-size: var(--font-size-sm);
  visibility: hidden;
  min-height: 18px;
}

.commits-filter-popover .commits-filter-date-hint.visible {
  visibility: visible;
}

.commits-filter-popover .filter-options-footer {
  padding: var(--spacing-half) 0 var(--spacing) 0;
  margin-top: var(--spacing-quarter);
  text-align: left;
}

/* \u2500\u2500 List \u2500\u2500 */

.commits-commit-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* \u2500\u2500 Empty state (native blankslate pattern) \u2500\u2500 */

.commits-commit-list .commits-filter-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-half);
  padding: var(--spacing);
  max-width: 260px;
}

.commits-commit-list .commits-filter-empty .commits-filter-empty-icon.octicon {
  width: 32px;
  height: 32px;
  fill: var(--text-secondary-color);
  opacity: 0.6;
}

.commits-commit-list .commits-filter-empty h2 {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--text-color);
}

.commits-commit-list .commits-filter-empty p {
  margin: 0;
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
}

.commits-commit-list .commits-filter-empty .commits-filter-empty-action {
  margin-top: var(--spacing-half);
}
`;
  var injected = false;
  function injectStyles() {
    if (injected) {
      return;
    }
    injected = true;
    const style = document.createElement("style");
    style.setAttribute("data-plugin", "commits-filter");
    style.textContent = css;
    document.head.appendChild(style);
  }

  // plugins/commits-filter/src/index.tsx
  injectStyles();
  registerRepositorySection({
    id: "commits-filter",
    title: "Commits",
    sidebarComponent: CommitsSidebar,
    refreshOnActivate: "history"
  });
})();
