(() => {
  // plugins/changes-tree/src/ghd.ts
  var api = globalThis.__GHD_EXTENSION_API__;
  var React = api.React;
  var components = api.components;
  var octicons = api.octicons;
  var Popover = api.Popover;
  var PopoverAnchorPosition = api.PopoverAnchorPosition;
  var PopoverDecoration = api.PopoverDecoration;
  var CheckboxValue = api.CheckboxValue;
  var DiffSelectionType = api.DiffSelectionType;
  var registerChangesFileView = api.registerChangesFileView;

  // plugins/changes-tree/src/index.tsx
  var { Checkbox, ChangedFile, TextBox, Octicon, Button } = globalThis.__GHD_EXTENSION_API__.components;
  var NoStatusFilters = {
    isIncludedInCommit: false,
    isExcludedFromCommit: false,
    isNewFile: false,
    isModifiedFile: false,
    isDeletedFile: false
  };
  function buildTree(files) {
    const root = /* @__PURE__ */ new Map();
    for (const file of files) {
      const segments = file.path.split("/");
      let level = root;
      let prefix = "";
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        prefix = prefix.length === 0 ? segment : `${prefix}/${segment}`;
        const isLeaf = i === segments.length - 1;
        let node = level.get(segment);
        if (node === void 0) {
          node = {
            name: segment,
            path: prefix,
            children: /* @__PURE__ */ new Map(),
            file: isLeaf ? file : void 0
          };
          level.set(segment, node);
        } else if (isLeaf) {
          node.file = file;
        }
        level = node.children;
      }
    }
    return root;
  }
  function isIncluded(file) {
    return file.selection.getSelectionType() === DiffSelectionType.All;
  }
  function statusKindOf(file) {
    return String(file?.status?.kind ?? "");
  }
  function matchesStatusFilters(file, filters) {
    const active = Object.values(filters);
    if (!active.some(Boolean)) {
      return true;
    }
    if (filters.isIncludedInCommit && !isIncluded(file)) {
      return false;
    }
    if (filters.isExcludedFromCommit && isIncluded(file)) {
      return false;
    }
    if (filters.isNewFile && statusKindOf(file) !== "New" && statusKindOf(file) !== "Untracked") {
      return false;
    }
    if (filters.isModifiedFile && statusKindOf(file) !== "Modified") {
      return false;
    }
    if (filters.isDeletedFile && statusKindOf(file) !== "Deleted") {
      return false;
    }
    return true;
  }
  function styleInjection() {
    return /* @__PURE__ */ (void 0)("style", null, treeCss);
  }
  function flattenTree(nodes, collapsed, depth, out) {
    const sorted = [...nodes.values()].sort((a, b) => {
      const aDir = a.file === void 0 ? 0 : 1;
      const bDir = b.file === void 0 ? 0 : 1;
      if (aDir !== bDir) {
        return aDir - bDir;
      }
      return a.name.localeCompare(b.name);
    });
    for (const node of sorted) {
      const isFolder = node.file === void 0;
      const descendantCount = isFolder ? countFiles(node) : 0;
      out.push({
        depth,
        name: node.name,
        path: node.path,
        file: node.file,
        descendantCount
      });
      if (isFolder && !collapsed.has(node.path)) {
        flattenTree(node.children, collapsed, depth + 1, out);
      }
    }
  }
  function countFiles(node) {
    let total = node.file !== void 0 ? 1 : 0;
    for (const child of node.children.values()) {
      total += countFiles(child);
    }
    return total;
  }
  function countStatuses(files) {
    let included = 0;
    let excluded = 0;
    let newFiles = 0;
    let modifiedFiles = 0;
    let deletedFiles = 0;
    for (const file of files) {
      if (isIncluded(file)) {
        included++;
      } else {
        excluded++;
      }
      const kind = statusKindOf(file);
      if (kind === "New" || kind === "Untracked") {
        newFiles++;
      } else if (kind === "Modified") {
        modifiedFiles++;
      } else if (kind === "Deleted") {
        deletedFiles++;
      }
    }
    return { included, excluded, newFiles, modifiedFiles, deletedFiles };
  }
  function TreeCaret(props) {
    const path = props.expanded ? "M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z" : "M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z";
    return /* @__PURE__ */ (void 0)(
      "svg",
      {
        className: `tree-caret${props.expanded ? " expanded" : ""}`,
        viewBox: "0 0 16 16",
        width: "16",
        height: "16",
        fill: "currentColor",
        "aria-hidden": "true"
      },
      /* @__PURE__ */ (void 0)("path", { d: path })
    );
  }
  var ChangesTreeView = class extends (void 0) {
    filterButtonRef = null;
    constructor(props) {
      super(props);
      this.state = {
        collapsedFolders: /* @__PURE__ */ new Set(),
        filterText: "",
        statusFilters: NoStatusFilters,
        isFilterOptionsOpen: false
      };
    }
    toggleFolder = (path) => {
      this.setState((prevState) => {
        const collapsedFolders = new Set(prevState.collapsedFolders);
        if (collapsedFolders.has(path)) {
          collapsedFolders.delete(path);
        } else {
          collapsedFolders.add(path);
        }
        return { collapsedFolders };
      });
    };
    onFilterTextChanged = (value) => {
      this.setState({ filterText: value });
    };
    toggleFilterOptionsOpen = () => {
      this.setState((prevState) => ({
        isFilterOptionsOpen: !prevState.isFilterOptionsOpen
      }));
    };
    closeFilterOptions = () => {
      this.setState({ isFilterOptionsOpen: false });
    };
    onStatusFilterChanged = (key) => (event) => {
      this.setState((prevState) => ({
        statusFilters: {
          ...prevState.statusFilters,
          [key]: event.currentTarget.checked
        }
      }));
    };
    clearStatusFilters = () => {
      this.setState({ statusFilters: NoStatusFilters });
    };
    renderFilterPopover(files) {
      const filters = this.state.statusFilters;
      const counts = countStatuses(files);
      const activeCount = Object.values(filters).filter(Boolean).length;
      const checkboxRow = (key, label, count) => /* @__PURE__ */ (void 0)(
        Checkbox,
        {
          key,
          value: filters[key] ? CheckboxValue.On : CheckboxValue.Off,
          onChange: this.onStatusFilterChanged(key),
          label: `${label} (${count})`
        }
      );
      return /* @__PURE__ */ (void 0)(
        Popover,
        {
          className: "filter-popover commits-tree-filter-popover",
          ariaLabelledby: "changes-tree-filter-header",
          anchor: this.filterButtonRef,
          anchorPosition: PopoverAnchorPosition.BottomRight,
          decoration: PopoverDecoration.Balloon,
          onMousedownOutside: this.closeFilterOptions,
          onClickOutside: this.closeFilterOptions
        },
        /* @__PURE__ */ (void 0)("div", { className: "filter-popover-header" }, /* @__PURE__ */ (void 0)("h3", { id: "changes-tree-filter-header" }, "Filter Options"), /* @__PURE__ */ (void 0)(
          "button",
          {
            className: "close",
            onClick: this.closeFilterOptions,
            "aria-label": "Close"
          },
          /* @__PURE__ */ (void 0)(Octicon, { symbol: octicons.x })
        )),
        /* @__PURE__ */ (void 0)("div", { className: "commits-tree-filter-options" }, checkboxRow("isIncludedInCommit", "Included in commit", counts.included), checkboxRow("isExcludedFromCommit", "Excluded from commit", counts.excluded), checkboxRow("isNewFile", "New files", counts.newFiles), checkboxRow("isModifiedFile", "Modified files", counts.modifiedFiles), checkboxRow("isDeletedFile", "Deleted files", counts.deletedFiles)),
        activeCount > 0 ? /* @__PURE__ */ (void 0)("div", { className: "filter-options-footer" }, /* @__PURE__ */ (void 0)(Button, { onClick: this.clearStatusFilters }, "Clear filters")) : null
      );
    }
    render() {
      const { files, availableWidth } = this.props;
      const filterText = this.state.filterText.trim().toLowerCase();
      const statusFilters = this.state.statusFilters;
      const statusActive = Object.values(statusFilters).some(Boolean);
      const visibleFiles = files.filter((file) => {
        if (filterText.length > 0 && !file.path.toLowerCase().includes(filterText)) {
          return false;
        }
        return matchesStatusFilters(file, statusFilters);
      });
      const tree = buildTree(visibleFiles);
      const rows = [];
      flattenTree(tree, this.state.collapsedFolders, 0, rows);
      const counts = countStatuses(files);
      const activeCount = Object.values(statusFilters).filter(Boolean).length;
      return /* @__PURE__ */ (void 0)("div", { className: "changes-tree file-list" }, styleInjection(), /* @__PURE__ */ (void 0)("div", { className: "changes-tree-header-row" }, /* @__PURE__ */ (void 0)("div", { className: "filter-box-container" }, /* @__PURE__ */ (void 0)(
        "button",
        {
          className: `button-component filter-button${activeCount > 0 ? " active" : ""}`,
          onClick: this.toggleFilterOptionsOpen,
          ariaExpanded: this.state.isFilterOptionsOpen,
          onButtonRef: (ref) => this.filterButtonRef = ref,
          title: "Filter Options",
          ariaLabel: "Filter Options"
        },
        /* @__PURE__ */ (void 0)("span", null, /* @__PURE__ */ (void 0)(Octicon, { symbol: octicons.filter })),
        activeCount > 0 ? /* @__PURE__ */ (void 0)("span", { className: "active-badge" }, /* @__PURE__ */ (void 0)("div", { className: "badge-bg" }, /* @__PURE__ */ (void 0)("div", { className: "badge" }))) : null
      ), /* @__PURE__ */ (void 0)(
        TextBox,
        {
          value: this.state.filterText,
          placeholder: "Filter",
          className: "filter-list-filter-field",
          onValueChanged: this.onFilterTextChanged
        }
      ), this.props.viewSwitch), this.state.isFilterOptionsOpen ? this.renderFilterPopover(files) : null, /* @__PURE__ */ (void 0)("div", { className: "checkbox-container" }, /* @__PURE__ */ (void 0)(
        Checkbox,
        {
          value: includeAllValue,
          onChange: (event) => onIncludeAllChanged(event.currentTarget.checked),
          ariaLabel: "Include all changed files",
          className: "changes-tree-check-all",
          label: `${files.length} changed file${files.length === 1 ? "" : "s"}`
        }
      ))), rows.map((row) => {
        const isFolder = row.file === void 0;
        const include = !isFolder && row.file.selection.getSelectionType() === DiffSelectionType.All;
        return /* @__PURE__ */ (void 0)(
          "div",
          {
            key: row.path,
            className: `changes-tree-row list-item${include ? " included" : ""}`,
            style: { paddingLeft: 8 + row.depth * 14 },
            onClick: () => {
              if (isFolder) {
                this.toggleFolder(row.path);
              } else {
                this.props.onSelectionChanged([row.file]);
              }
            },
            onContextMenu: isFolder ? void 0 : (event) => {
              event.preventDefault();
              this.props.onFileContextMenu(row.file, event);
            },
            title: row.path
          },
          isFolder ? /* @__PURE__ */ (void 0)(
            TreeCaret,
            {
              expanded: !this.state.collapsedFolders.has(row.path)
            }
          ) : /* @__PURE__ */ (void 0)("span", { className: "tree-indent", "aria-hidden": "true" }),
          isFolder ? /* @__PURE__ */ (void 0)("span", { className: "tree-name" }, row.name) : /* @__PURE__ */ (void 0)(
            ChangedFile,
            {
              file: row.file,
              include,
              availableWidth: Math.max(
                140,
                (availableWidth ?? 340) - 24 - row.depth * 14
              ),
              disableSelection: false,
              focused: false,
              onIncludeChanged: this.props.onIncludeChanged
            }
          ),
          isFolder ? /* @__PURE__ */ (void 0)("span", { className: "tree-count" }, row.descendantCount) : null
        );
      }));
    }
  };
})();
