/**
 * Styles for the commits-filter plugin, injected once into the document head
 * at registration time. Dynamic plugins cannot rely on the host's compiled
 * SCSS, so the plugin ships its own CSS — built from the same design tokens
 * (CSS custom properties) the host uses.
 *
 * Selector ↔ component checklist (keep in sync with the TSX):
 *   #commits-view                        ← sidebar root
 *   #commits-view .filter-box-container  ← joined filter button + search box
 *   #commits-view .commits-filter-summary ← match count row
 *   .commits-filter-popover              ← advanced filters popover
 *   .commits-filter-popover .commits-filter-options ← popover field stack
 *   .commits-commit-list                 ← list container
 *   .commits-commit-list .commits-filter-empty ← blankslate
 */

const css = `
#commits-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
}

/* ── Filter bar: joined filter-options button + message search box ── */

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

#commits-view .changes-view-switch-icons {
  display: flex;
  align-items: center;
  margin-left: var(--spacing-half);
}

#commits-view .changes-view-switch-icon {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--text-secondary-color);
  width: 26px;
  height: var(--text-field-height);
  padding: 0;
  margin-left: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: default;
  border-radius: var(--border-radius);
}

#commits-view .changes-view-switch-icon:hover {
  color: var(--text-color);
  background: var(--box-hover-background-color, rgba(255, 255, 255, 0.07));
}

#commits-view .changes-view-switch-icon.selected {
  color: var(--box-selected-active-text-color);
  background: var(--box-selected-active-background-color);
}

#commits-view .changes-view-switch-icon .octicon {
  fill: currentColor;
}

/* ── Summary row: match count ── */

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

/* ── Advanced filters popover (host Popover, plugin layout) ── */

.commits-filter-popover {
  text-align: left;
  min-width: 280px;
}

.commits-filter-popover .popover-content {
  padding: var(--spacing);
}

.commits-filter-popover .filter-popover-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing);
}

.commits-filter-popover .filter-popover-header h3 {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
}

.commits-filter-popover .close {
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

.commits-filter-popover .close .octicon {
  pointer-events: none;
}

.commits-filter-popover .close:hover {
  color: var(--text-color);
}

.commits-filter-popover .commits-filter-options {
  display: flex;
  flex-direction: column;
  gap: var(--spacing);
  margin: 0;
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

.commits-filter-popover .commits-filter-date-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--spacing-half);
}

.commits-filter-popover .commits-filter-date-row input[type='date'] {
  flex: 1;
  min-width: 0;
  height: var(--text-field-height);
  padding: 0 var(--spacing-half);
  border: var(--base-border);
  border-radius: var(--border-radius);
  background: var(--box-background-color);
  color: var(--text-color);
  font-size: var(--font-size);
  font-family: var(--font-family-sans-serif);
}

.commits-filter-popover .commits-filter-date-row input[type='date']:focus {
  outline: none;
  border-color: var(--focus-color);
  box-shadow: 0 0 0 1px var(--text-field-focus-shadow-color);
}

.commits-filter-popover .commits-filter-dates-separator {
  color: var(--text-secondary-color);
  flex: initial;
}

.commits-filter-popover .filter-options-footer {
  border-top: var(--base-border);
  padding-top: var(--spacing);
  margin-top: var(--spacing-half);
  text-align: left;
}

/* ── List ── */

.commits-commit-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.commits-commit-list #commit-list {
  flex: 1;
  min-height: 0;
}

/* ── Empty state (native blankslate pattern) ── */

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
`

let injected = false

/** Injects the plugin styles into the document head (once). */
export function injectStyles() {
  if (injected) {
    return
  }
  injected = true

  const style = document.createElement('style')
  style.setAttribute('data-plugin', 'commits-filter')
  style.textContent = css
  document.head.appendChild(style)
}
