(() => {
  // plugins/commits-filter/src/ghd.ts
  var api = globalThis.__GHD_EXTENSION_API__;
  var React = api.React;
  var components = api.components;
  var octicons = api.octicons;
  var PopupType = api.PopupType;
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
  var __DARWIN__ = globalThis.__GHD_EXTENSION_API__.isDarwin;
  function cx(...parts) {
    return parts.filter(Boolean).join(" ");
  }
  var { CommitList, TextBox, Select, Button, Octicon } = globalThis.__GHD_EXTENSION_API__.components;
  var octicons2 = globalThis.__GHD_EXTENSION_API__.octicons;
  var PopupType2 = globalThis.__GHD_EXTENSION_API__.PopupType;
  var CloseToBottomThreshold = 10;
  var AllAuthorsValue = "";
  var CommitsSidebar = class extends React.Component {
    commitListRef = { current: null };
    loadChangedFilesTimer = null;
    loadingMoreCommitsPromise = null;
    constructor(props) {
      super(props);
      this.state = { filter: EmptyCommitFilter, expanded: false };
    }
    componentWillMount() {
      this.props.dispatcher.initializeCompare(this.props.repository);
    }
    /** Focuses the commit list (used by the "Show Commits" menu accelerator). */
    focus() {
      ;
      this.commitListRef.current?.focus();
    }
    onToggleExpanded = () => {
      this.setState((prevState) => ({ expanded: !prevState.expanded }));
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
    renderAdvancedFilters(authors, filter) {
      const dateFromInvalid = filter.dateFrom !== null && !isValidDateString(filter.dateFrom);
      const dateToInvalid = filter.dateTo !== null && !isValidDateString(filter.dateTo);
      return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
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
        authors.map((author) => /* @__PURE__ */ React.createElement("option", { key: author.email, value: author.email }, author.name))
      )), /* @__PURE__ */ React.createElement("div", { className: "commits-filter-row commits-filter-dates" }, /* @__PURE__ */ React.createElement(
        TextBox,
        {
          className: cx("commits-filter-date-field", {
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
          className: cx("commits-filter-date-field", {
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
          className: cx("commits-filter-date-hint", {
            visible: dateFromInvalid || dateToInvalid
          }),
          role: "alert"
        },
        __DARWIN__ ? "Invalid Date" : "Invalid date",
        " \u2014 YYYY-MM-DD"
      ));
    }
    renderFilterBar(authors, filter, filtersActive, hiddenFiltersActive, matchingCount, totalCount) {
      const messageText = filter.messageTerms.join(" ");
      const { expanded } = this.state;
      return /* @__PURE__ */ React.createElement("div", { className: "commits-filter" }, /* @__PURE__ */ React.createElement("div", { className: "commits-filter-row commits-filter-primary" }, /* @__PURE__ */ React.createElement(
        Button,
        {
          className: cx("commits-filter-toggle", {
            selected: hiddenFiltersActive && !expanded
          }),
          ariaExpanded: expanded,
          tooltip: expanded ? __DARWIN__ ? "Hide Advanced Filters" : "Hide advanced filters" : __DARWIN__ ? "Show Advanced Filters" : "Show advanced filters",
          onClick: this.onToggleExpanded
        },
        /* @__PURE__ */ React.createElement(
          Octicon,
          {
            symbol: expanded ? octicons2.chevronUp : hiddenFiltersActive ? octicons2.filter : octicons2.chevronDown
          }
        )
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
      )), expanded ? this.renderAdvancedFilters(authors, filter) : null, /* @__PURE__ */ React.createElement("div", { className: "commits-filter-row commits-filter-summary" }, /* @__PURE__ */ React.createElement("span", { className: "commits-filter-count", "aria-live": "polite" }, filtersActive ? `${matchingCount} of ${totalCount} commits` : `${totalCount} commits`), filtersActive ? /* @__PURE__ */ React.createElement(
        Button,
        {
          className: "commits-filter-clear-button",
          onClick: this.onClearFilters
        },
        __DARWIN__ ? "Clear Filters" : "Clear filters"
      ) : null));
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
      const authors = getCommitAuthors(commits);
      const hiddenFiltersActive = filtersActive && !this.state.expanded && (filter.authorEmails.length > 0 || filter.descriptionTerm.trim().length > 0 || filter.dateFrom !== null || filter.dateTo !== null);
      const emptyListMessage = filtersActive ? /* @__PURE__ */ React.createElement("div", { className: "commits-filter-empty" }, /* @__PURE__ */ React.createElement(Octicon, { className: "commits-filter-empty-icon", symbol: octicons2.search }), /* @__PURE__ */ React.createElement("h2", null, "No commits match your filters"), /* @__PURE__ */ React.createElement("p", null, "Try adjusting or clearing your filters."), /* @__PURE__ */ React.createElement(
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
          authors,
          filter,
          filtersActive,
          hiddenFiltersActive,
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
            onCreateTag: (targetCommitSha) => dispatcher.showCreateTagDialog(repository, targetCommitSha, localTags),
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

  // plugins/commits-filter/src/index.ts
  registerRepositorySection({
    id: "commits-filter",
    title: "Commits",
    sidebarComponent: CommitsSidebar,
    refreshOnActivate: "history"
  });
})();
