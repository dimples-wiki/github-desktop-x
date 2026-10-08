import type { ComponentClass } from 'react'

import type { IRepositoryState } from '../app-state'
import type { Repository } from '../../models/repository'
import type { Account } from '../../models/account'
import type { Emoji } from '../emoji'
import type { Commit, CommitOneLine } from '../../models/commit'
import type { Dispatcher } from '../../ui/dispatcher'
import { RepositorySectionTab } from '../app-state'

/**
 * Everything a repository-section extension receives to render its sidebar.
 *
 * The context intentionally mirrors the data the built-in History sidebar
 * uses, so extensions can reuse the very same building blocks (commit list,
 * dispatcher actions, etc.) and feel fully native.
 */
export interface IRepositorySectionContext {
  readonly repository: Repository

  /** The full repository state of the selected repository. */
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

/**
 * A repository section extension contributes an additional tab next to
 * Changes and History.
 *
 * The sidebar component must be a **class component** implementing a
 * `focus()` method so that the "Show <section>" menu accelerator can focus
 * its list, mirroring the built-in tabs.
 */
export interface IRepositorySectionExtension {
  /** Unique, stable identifier (kebab-case), matches the plugin manifest. */
  readonly id: string

  /** Title shown on the repository tab. */
  readonly title: string

  readonly sidebarComponent: ComponentClass<IRepositorySectionContext>

  /**
   * Which refresh to run when the section is activated. `'history'` reuses
   * the built-in history refresh (local commits + compare initialization),
   * which is what sections displaying commit data want. Default: 'history'.
   */
  readonly refreshOnActivate?: 'history'
}

/** A plugin-provided replacement for the changes file list (e.g. tree view). */
export interface IChangesFileViewExtension {
  readonly id: string
  readonly title: string

  readonly component: ComponentClass<IChangesFileViewProps>
}

/** Props handed to a registered changes file view. */
export interface IChangesFileViewProps {
  /** All changed files of the working directory. */
  readonly files: ReadonlyArray<any>

  /** Notify the host that the user selected these files (diff follows). */
  readonly onSelectionChanged: (files: ReadonlyArray<any>) => void
}

const sectionRegistry = new Map<string, IRepositorySectionExtension>()
const changesFileViewRegistry = new Map<string, IChangesFileViewExtension>()

const sectionListeners = new Set<() => void>()
const changesFileViewListeners = new Set<() => void>()

function notify(listeners: Set<() => void>) {
  for (const listener of listeners) {
    try {
      listener()
    } catch (error) {
      log.error(`Extension registry listener failed`, error)
    }
  }
}

/**
 * Registers a repository section extension.
 *
 * Extensions are loaded at runtime (see plugin-loader); the tab bar
 * re-renders automatically through the registry subscription.
 */
export function registerRepositorySection(
  extension: IRepositorySectionExtension
) {
  if (sectionRegistry.has(extension.id)) {
    throw new Error(
      `Repository section extension '${extension.id}' is already registered`
    )
  }

  sectionRegistry.set(extension.id, extension)
  notify(sectionListeners)
}

/**
 * Registers the plugin-provided changes file view. While registered it
 * replaces the built-in flat file list (see ChangesFileViewSlot).
 */
export function registerChangesFileView(extension: IChangesFileViewExtension) {
  changesFileViewRegistry.clear()
  changesFileViewRegistry.set(extension.id, extension)
  notify(changesFileViewListeners)
}

/** All registered repository section extensions, in registration order. */
export function getRepositorySectionExtensions(): ReadonlyArray<IRepositorySectionExtension> {
  return [...sectionRegistry.values()]
}

/** The repository section a given extension is rendered under. */
export function getSectionForExtension(
  extension: IRepositorySectionExtension
): RepositorySectionTab {
  const extensions = [...sectionRegistry.values()]
  const index = extensions.indexOf(extension)
  return RepositorySectionTab.ExtensionStart + index
}

/** Inverse of `getSectionForExtension` for a zero-based tab index. */
export function sectionForExtensionIndex(index: number): RepositorySectionTab {
  return RepositorySectionTab.ExtensionStart + index
}

/** The extension rendered under the given section, if any. */
export function getExtensionForSection(
  section: RepositorySectionTab
): IRepositorySectionExtension | undefined {
  if (section < RepositorySectionTab.ExtensionStart) {
    return undefined
  }

  const extensions = [...sectionRegistry.values()]
  return extensions[section - RepositorySectionTab.ExtensionStart]
}

/** Looks a registered extension up by id. */
export function getRepositorySectionExtensionById(
  id: string
): IRepositorySectionExtension | undefined {
  return sectionRegistry.get(id)
}

/** The DOM id of the tab element for the given extension. */
export function getTabIdForExtension(
  extension: IRepositorySectionExtension
): string {
  return `extension-tab-${extension.id}`
}

/** The registered changes file view, if a plugin provided one. */
export function getRegisteredChangesFileView():
  | IChangesFileViewExtension
  | undefined {
  return [...changesFileViewRegistry.values()][0]
}

/** The id of the built-in changes file view (the host's flat list). */
export const BuiltInChangesFileViewId = 'builtin'

let activeChangesFileViewId: string = BuiltInChangesFileViewId

/** Selects which changes file view is displayed ('builtin' or a plugin id). */
export function setActiveChangesFileView(id: string) {
  if (activeChangesFileViewId === id) {
    return
  }

  activeChangesFileViewId = id
  notify(changesFileViewListeners)
}

/** The currently selected changes file view id. */
export function getActiveChangesFileViewId(): string {
  return activeChangesFileViewId
}

/** Subscribes to repository section registry changes. Returns unsubscribe. */
export function subscribeRepositorySectionExtensions(
  listener: () => void
): () => void {
  sectionListeners.add(listener)
  return () => sectionListeners.delete(listener)
}

/** Subscribes to changes file view registry changes. Returns unsubscribe. */
export function subscribeChangesFileView(listener: () => void): () => void {
  changesFileViewListeners.add(listener)
  return () => changesFileViewListeners.delete(listener)
}

/** Debug helper: current registry sizes (used by the plugin loader log). */
export function getExtensionRegistrySizes(): string {
  return `sections=${sectionRegistry.size} views=${changesFileViewRegistry.size}`
}

/** Test-only helper to reset the registries between test files. */
export function clearExtensionsForTests() {
  sectionRegistry.clear()
  changesFileViewRegistry.clear()
  sectionListeners.clear()
  changesFileViewListeners.clear()
}
