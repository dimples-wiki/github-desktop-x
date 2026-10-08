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
  var treeCss = `
.changes-tree-header-row {
  display: flex;
  align-items: center;
  padding: var(--spacing-half);
  border-bottom: var(--base-border);
}

.changes-tree .filter-box-container {
  display: flex;
  align-items: center;
  flex: 1;
}

.changes-tree .filter-box-container input {
  border-radius: 0 var(--border-radius) var(--border-radius) 0;
}

.changes-tree .filter-button {
  border-radius: var(--border-radius) 0 0 var(--border-radius);
  border-right: none;
  font-weight: var(--font-weight-semibold);
  color: var(--text-color);
  display: inline-flex;
  align-items: center;
  position: relative;
}

.changes-tree .filter-button.active span:first-child {
  color: var(--box-selected-active-background-color);
}

.changes-tree .filter-button .active-badge {
  position: absolute;
  right: 18px;
  top: 4px;
}

.changes-tree .filter-button .active-badge .badge-bg {
  padding: 1px;
  border-radius: 50%;
  background-color: var(--secondary-button-background);
}

.changes-tree .filter-button .active-badge .badge {
  width: 5px;
  height: 5px;
  background-color: var(--box-selected-active-background-color);
  border-radius: 50%;
}

.changes-tree-header {
  padding: var(--spacing-half) var(--spacing);
  border-bottom: var(--base-border);
}

.changes-tree-header .checkbox-component {
  display: flex;
}

.changes-tree {
  flex: 1;
  overflow-y: auto;
  user-select: none;
}

.changes-tree-row {
  display: flex;
  align-items: center;
  height: 29px;
  padding-right: var(--spacing, 8px);
  cursor: default;
}

.changes-tree-row:hover {
  background: var(--box-hover-background-color, rgba(255, 255, 255, 0.04));
}

.changes-tree-row .tree-caret {
  width: 16px;
  height: 16px;
  flex: initial;
  margin-right: 2px;
  fill: var(--text-secondary-color);
}

.changes-tree-row .tree-indent {
  width: 10px;
  flex: initial;
}

.changes-tree-row .tree-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--font-size, 12px);
  color: var(--text-secondary-color);
}

.changes-tree-row .tree-count {
  margin-left: auto;
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm, 11px);
}

.changes-view-slot .filter-box-container input {
  border-radius: 0 var(--border-radius) var(--border-radius) 0;
}

.commits-tree-filter-popover {
  text-align: left;
  min-width: 240px;
}

.commits-tree-filter-popover .popover-content {
  padding: var(--spacing);
}

.commits-tree-filter-popover .filter-popover-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing);
}

.commits-tree-filter-popover .filter-popover-header h3 {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.commits-tree-filter-popover .close {
  flex-shrink: 0;
  border: 0;
  height: 16px;
  width: 16px;
  padding: 0;
  background: transparent;
  color: var(--text-secondary-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
}

.commits-tree-filter-popover .close .octicon {
  pointer-events: none;
}

.commits-tree-filter-popover .close:hover {
  color: var(--text-color);
}

.commits-tree-filter-popover .filter-options {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-half);
  margin: 0;
}

.commits-tree-filter-popover .filter-options-footer {
  border-top: var(--base-border);
  padding-top: var(--spacing-half);
  margin-top: var(--spacing-half);
  text-align: left;
}

.commits-tree-filter-popover .button-component {
  min-width: 60px;
}
`;
  function styleInjection() {
    return /* @__PURE__ */ React.createElement("style", null, treeCss);
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
    return /* @__PURE__ */ React.createElement(
      "svg",
      {
        className: `tree-caret${props.expanded ? " expanded" : ""}`,
        viewBox: "0 0 16 16",
        width: "16",
        height: "16",
        fill: "currentColor",
        "aria-hidden": "true"
      },
      /* @__PURE__ */ React.createElement("path", { d: path })
    );
  }
  var ChangesTreeView = class extends React.Component {
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
      const checkboxRow = (key, label, count) => /* @__PURE__ */ React.createElement(
        Checkbox,
        {
          key,
          value: filters[key] ? CheckboxValue.On : CheckboxValue.Off,
          onChange: this.onStatusFilterChanged(key),
          label: `${label} (${count})`
        }
      );
      return /* @__PURE__ */ React.createElement(
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
        /* @__PURE__ */ React.createElement("div", { className: "filter-popover-header" }, /* @__PURE__ */ React.createElement("h3", { id: "changes-tree-filter-header" }, "Filter Options"), /* @__PURE__ */ React.createElement(
          "button",
          {
            className: "close",
            onClick: this.closeFilterOptions,
            "aria-label": "Close"
          },
          /* @__PURE__ */ React.createElement(Octicon, { symbol: octicons.x })
        )),
        /* @__PURE__ */ React.createElement("div", { className: "commits-tree-filter-options" }, checkboxRow("isIncludedInCommit", "Included in commit", counts.included), checkboxRow("isExcludedFromCommit", "Excluded from commit", counts.excluded), checkboxRow("isNewFile", "New files", counts.newFiles), checkboxRow("isModifiedFile", "Modified files", counts.modifiedFiles), checkboxRow("isDeletedFile", "Deleted files", counts.deletedFiles)),
        activeCount > 0 ? /* @__PURE__ */ React.createElement("div", { className: "filter-options-footer" }, /* @__PURE__ */ React.createElement(Button, { onClick: this.clearStatusFilters }, "Clear filters")) : null
      );
    }
    render() {
      const { files, availableWidth, includeAllValue, onIncludeAllChanged } = this.props;
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
      return /* @__PURE__ */ React.createElement("div", { className: "file-list" }, /* @__PURE__ */ React.createElement("div", { className: "list-focus-container" }, /* @__PURE__ */ React.createElement("div", { className: "changes-tree" }, styleInjection(), /* @__PURE__ */ React.createElement("div", { className: "changes-tree-header-row" }, /* @__PURE__ */ React.createElement("div", { className: "filter-box-container" }, /* @__PURE__ */ React.createElement(
        "button",
        {
          className: `button-component filter-button${activeCount > 0 ? " active" : ""}`,
          onClick: this.toggleFilterOptionsOpen,
          ariaExpanded: this.state.isFilterOptionsOpen,
          onButtonRef: (ref) => this.filterButtonRef = ref,
          title: "Filter Options",
          ariaLabel: "Filter Options"
        },
        /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement(Octicon, { symbol: octicons.filter })),
        activeCount > 0 ? /* @__PURE__ */ React.createElement("span", { className: "active-badge" }, /* @__PURE__ */ React.createElement("div", { className: "badge-bg" }, /* @__PURE__ */ React.createElement("div", { className: "badge" }))) : null
      ), /* @__PURE__ */ React.createElement(
        TextBox,
        {
          value: this.state.filterText,
          placeholder: "Filter",
          className: "filter-list-filter-field",
          onValueChanged: this.onFilterTextChanged
        }
      ), this.props.viewSwitch), this.state.isFilterOptionsOpen ? this.renderFilterPopover(files) : null, /* @__PURE__ */ React.createElement("div", { className: "checkbox-container" }, /* @__PURE__ */ React.createElement(
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
        return /* @__PURE__ */ React.createElement(
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
          isFolder ? /* @__PURE__ */ React.createElement(
            TreeCaret,
            {
              expanded: !this.state.collapsedFolders.has(row.path)
            }
          ) : /* @__PURE__ */ React.createElement("span", { className: "tree-indent", "aria-hidden": "true" }),
          isFolder ? /* @__PURE__ */ React.createElement("span", { className: "tree-name" }, row.name) : /* @__PURE__ */ React.createElement(
            ChangedFile,
            {
              file: { ...row.file, path: row.name },
              include,
              availableWidth: Math.max(
                140,
                (availableWidth ?? 340) - 24 - row.depth * 14
              ),
              disableSelection: false,
              focused: false,
              onIncludeChanged: (f, inc) => this.props.onIncludeChanged(row.file, inc)
            }
          ),
          isFolder ? /* @__PURE__ */ React.createElement("span", { className: "tree-count" }, row.descendantCount) : null
        );
      }))));
    }
  };
  globalThis.__GHD_EXTENSION_API__.registerChangesFileView({
    id: "changes-tree",
    title: "Tree",
    component: ChangesTreeView
  });
})();
