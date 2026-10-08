/**
 * Styles for the commits-filter plugin, injected once into the document head
 * at registration time. Dynamic plugins cannot rely on the host's compiled
 * SCSS, so the plugin ships its own CSS — built from the same design tokens
 * (CSS custom properties) the host uses.
 *
 * The filter bar replicates the host's `.filter-box-container` pattern
 * (filter options button joined with the search box) and the popover is the
 * host `Popover` component (`.popover-component` base styles come from the
 * host); only the plugin-specific layout lives here.
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

/* ── List ── */

.commits-commit-list {
  flex: 1;
  display: flex;
  flex-direction: column;
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
