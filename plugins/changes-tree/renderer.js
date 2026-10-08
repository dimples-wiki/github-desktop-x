(() => {
  // plugins/changes-tree/src/ghd.ts
  var api = globalThis.__GHD_EXTENSION_API__;
  var React = api.React;
  var registerChangesFileView = api.registerChangesFileView;

  // plugins/changes-tree/src/index.tsx
  var api2 = globalThis.__GHD_EXTENSION_API__;
  var { Checkbox } = api2.components;
  var CheckboxValue = api2.CheckboxValue;
  var DiffSelectionType = api2.DiffSelectionType;
  var StatusColors = {
    New: "#3fb950",
    Modified: "#d29922",
    Deleted: "#f85149",
    Renamed: "#a371f7",
    Copied: "#a371f7",
    Conflicted: "#f85149",
    Untracked: "#d29922"
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
  function statusColor(file) {
    return StatusColors[file?.status?.kind] ?? "#8b949e";
  }
  function statusLabel(file) {
    return String(file?.status?.kind ?? "Modified");
  }
  function isIncluded(file) {
    return file.selection.getSelectionType() === DiffSelectionType.All;
  }
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
  var ChangesTreeView = class extends React.Component {
    constructor(props) {
      super(props);
      this.state = { collapsedFolders: /* @__PURE__ */ new Set() };
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
    renderHeaderRow() {
      const { files, includeAllValue, onIncludeAllChanged } = this.props;
      return /* @__PURE__ */ React.createElement("div", { className: "changes-tree-header" }, /* @__PURE__ */ React.createElement(
        Checkbox,
        {
          value: includeAllValue,
          onChange: (event) => onIncludeAllChanged(event.currentTarget.checked),
          ariaLabel: "Include all changed files",
          className: "changes-tree-check-all",
          label: `${files.length} changed file${files.length === 1 ? "" : "s"}`
        }
      ));
    }
    render() {
      const { files, onIncludeChanged } = this.props;
      const tree = buildTree(files);
      const rows = [];
      flattenTree(tree, this.state.collapsedFolders, 0, rows);
      return /* @__PURE__ */ React.createElement("div", { className: "changes-tree" }, styleInjection(), this.renderHeaderRow(), rows.map((row) => {
        const isFolder = row.file === void 0;
        const included = !isFolder && isIncluded(row.file);
        return /* @__PURE__ */ React.createElement(
          "div",
          {
            key: row.path,
            className: `changes-tree-row${included ? " included" : ""}`,
            style: { paddingLeft: 8 + row.depth * 14 },
            onClick: () => {
              if (isFolder) {
                this.toggleFolder(row.path);
              } else {
                this.props.onSelectionChanged([row.file]);
              }
            },
            title: row.path
          },
          isFolder ? /* @__PURE__ */ React.createElement(
            TreeCaret,
            {
              expanded: !this.state.collapsedFolders.has(row.path)
            }
          ) : /* @__PURE__ */ React.createElement(
            "input",
            {
              type: "checkbox",
              className: "tree-include-checkbox",
              checked: included,
              onClick: (event) => event.stopPropagation(),
              onChange: (event) => onIncludeChanged(row.file, event.currentTarget.checked)
            }
          ),
          !isFolder ? /* @__PURE__ */ React.createElement(
            "span",
            {
              className: "tree-status-dot",
              style: { background: statusColor(row.file) },
              title: statusLabel(row.file)
            }
          ) : null,
          /* @__PURE__ */ React.createElement("span", { className: "tree-name" }, row.name),
          isFolder ? /* @__PURE__ */ React.createElement("span", { className: "tree-count" }, row.descendantCount) : null
        );
      }));
    }
  };
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
  var treeCss = `
.changes-tree-header {
  padding: var(--spacing-half) var(--spacing);
  border-bottom: var(--base-border);
}
.changes-tree-header .checkbox-component { display: flex; }
.changes-tree { flex: 1; overflow-y: auto; user-select: none; }
.changes-tree-row {
  display: flex; align-items: center; height: 29px;
  padding-right: var(--spacing, 8px); cursor: default;
  border-bottom: 1px solid var(--box-border-color, rgba(255,255,255,0.07));
}
.changes-tree-row:hover { background: var(--box-hover-background-color, rgba(255,255,255,0.04)); }
.changes-tree-row.included .tree-name { color: var(--text-color); }
.changes-tree-row .tree-caret {
  width: 16px; height: 16px; flex: initial; margin-right: 2px;
  fill: var(--text-secondary-color);
}
.changes-tree-row .tree-status-dot {
  width: 7px; height: 7px; border-radius: 50%; flex: initial;
  margin-right: 6px; margin-left: 2px;
}
.changes-tree-row .tree-include-checkbox {
  margin: 0 6px 0 2px; flex: initial; accent-color: var(--accent-color, #2f6feb);
}
.changes-tree-row .tree-name {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: var(--font-size, 12px); color: var(--text-secondary-color);
}
.changes-tree-row .tree-count {
  margin-left: auto; color: var(--text-secondary-color);
  font-size: var(--font-size-sm, 11px);
}
`;
  api2.registerChangesFileView({
    id: "changes-tree",
    title: "Tree",
    component: ChangesTreeView
  });
})();
