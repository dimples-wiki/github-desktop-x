/**
 * Styles for the commits-filter plugin, injected once into the document head
 * at registration time. Dynamic plugins cannot rely on the host's compiled
 * SCSS, so the plugin ships its own CSS — built from the same design tokens
 * (CSS custom properties) the host uses.
 */

const css = `
#commits-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
}

.commits-filter {
  background: var(--box-alt-background-color);
  flex: initial;
  padding: var(--spacing-half);
  border-bottom: var(--base-border);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-half);
}

.commits-filter .commits-filter-field {
  flex: 1;
  width: 100%;
}

.commits-filter .commits-filter-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--spacing-half);
}

.commits-filter .commits-filter-primary .commits-filter-toggle {
  flex: initial;
}

.commits-filter .commits-filter-primary .commits-filter-toggle .octicon {
  fill: var(--text-secondary-color);
}

.commits-filter .commits-filter-primary .commits-filter-toggle:hover .octicon {
  fill: var(--text-color);
}

.commits-filter .commits-filter-primary .commits-filter-toggle.selected {
  border-color: var(--box-border-accent-color);
  color: var(--box-selected-active-text-color);
  background: var(--box-selected-active-background-color);
}

.commits-filter .commits-filter-primary .commits-filter-toggle.selected .octicon {
  fill: var(--text-color);
}

.commits-filter .commits-filter-author {
  flex: 1;
}

.commits-filter .commits-filter-author select {
  width: 100%;
}

.commits-filter .commits-filter-dates .commits-filter-date-field {
  flex: 1;
  min-width: 0;
}

.commits-filter .commits-filter-dates .commits-filter-date-field.invalid-date input {
  border-color: var(--error-color);
}

.commits-filter .commits-filter-dates .commits-filter-date-field.invalid-date input:focus {
  border-color: var(--error-color);
  box-shadow: 0 0 0 1px rgba(248, 81, 73, 0.25);
}

.commits-filter .commits-filter-dates .commits-filter-dates-separator {
  color: var(--text-secondary-color);
  flex: initial;
}

.commits-filter .commits-filter-date-hint {
  color: var(--error-color);
  font-size: var(--font-size-sm);
  margin-top: calc(var(--spacing-half) * -1);
  visibility: hidden;
  min-height: 18px;
}

.commits-filter .commits-filter-date-hint.visible {
  visibility: visible;
}

.commits-filter .commits-filter-summary {
  justify-content: space-between;
}

.commits-filter .commits-filter-summary .commits-filter-count {
  color: var(--text-secondary-color);
  font-size: var(--font-size-sm);
  flex: 1;
}

.commits-filter .commits-filter-summary .commits-filter-clear-button {
  flex: initial;
}

.commits-commit-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

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
