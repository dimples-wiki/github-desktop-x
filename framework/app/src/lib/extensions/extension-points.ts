import type { ComponentClass } from "react";

import type { IRepositoryState } from "../app-state";
import type { Repository } from "../../models/repository";
import type { Account } from "../../models/account";
import type { Emoji } from "../emoji";
import type { Commit, CommitOneLine } from "../../models/commit";
import type { Dispatcher } from "../../ui/dispatcher";
import { RepositorySectionTab } from "../app-state";
import { builtInExtensions } from "./built-in-manifest";

/**
 * Everything a repository-section extension receives to render its sidebar.
 *
 * The context intentionally mirrors the data the built-in History sidebar
 * uses, so extensions can reuse the very same building blocks (commit list,
 * dispatcher actions, etc.) and feel fully native.
 */
export interface IRepositorySectionContext {
  readonly repository: Repository;

  /** The full repository state of the selected repository. */
  readonly state: IRepositoryState;

  readonly dispatcher: Dispatcher;
  readonly emoji: Map<string, Emoji>;
  readonly accounts: ReadonlyArray<Account>;

  readonly onRevertCommit: (commit: Commit) => void;
  readonly onAmendCommit: (commit: Commit, isLocalCommit: boolean) => void;
  readonly onViewCommitOnGitHub: (sha: string) => void;
  readonly onCherryPick: (
    repository: Repository,
    commits: ReadonlyArray<CommitOneLine>
  ) => void;

  readonly askForConfirmationOnCheckoutCommit: boolean;
  readonly preferAbsoluteDates: boolean;
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
  /** Unique, stable identifier (kebab-case). Must be listed in the manifest. */
  readonly id: string;

  /** Title shown on the repository tab. */
  readonly title: string;

  readonly sidebarComponent: ComponentClass<IRepositorySectionContext>;

  /**
   * Which refresh to run when the section is activated. `'history'` reuses
   * the built-in history refresh (local commits + compare initialization),
   * which is what sections displaying commit data want. Default: 'history'.
   */
  readonly refreshOnActivate?: "history";
}

const registry = new Map<string, IRepositorySectionExtension>();

/**
 * Registers a repository section extension.
 *
 * Extensions must be declared in `built-in-manifest.ts` (the manifest is
 * shared with the main process for menu construction) and are rendered in
 * manifest order, so tab and menu positions are stable.
 */
export function registerRepositorySection(
  extension: IRepositorySectionExtension
) {
  if (builtInExtensions.some((e) => e.id === extension.id) === false) {
    throw new Error(
      `Repository section extension '${extension.id}' must be listed in built-in-manifest.ts`
    );
  }

  if (registry.has(extension.id)) {
    throw new Error(
      `Repository section extension '${extension.id}' is already registered`
    );
  }

  registry.set(extension.id, extension);
}

/** All registered extensions, in stable (manifest) order. */
export function getRepositorySectionExtensions(): ReadonlyArray<IRepositorySectionExtension> {
  return builtInExtensions.flatMap((e) => {
    const extension = registry.get(e.id);
    return extension === undefined ? [] : [extension];
  });
}

/** The repository section a given extension is rendered under. */
export function getSectionForExtension(
  extension: IRepositorySectionExtension
): RepositorySectionTab {
  const index = builtInExtensions.findIndex((e) => e.id === extension.id);
  return RepositorySectionTab.ExtensionStart + index;
}

/** Inverse of `getSectionForExtension` for a zero-based tab index. */
export function sectionForExtensionIndex(index: number): RepositorySectionTab {
  return RepositorySectionTab.ExtensionStart + index;
}

/** The extension rendered under the given section, if any. */
export function getExtensionForSection(
  section: RepositorySectionTab
): IRepositorySectionExtension | undefined {
  if (section < RepositorySectionTab.ExtensionStart) {
    return undefined;
  }

  const entry =
    builtInExtensions[section - RepositorySectionTab.ExtensionStart];
  return entry === undefined ? undefined : registry.get(entry.id);
}

/** Looks a registered extension up by id. */
export function getRepositorySectionExtensionById(
  id: string
): IRepositorySectionExtension | undefined {
  return registry.get(id);
}

/** The DOM id of the tab element for the given extension. */
export function getTabIdForExtension(
  extension: IRepositorySectionExtension
): string {
  return `extension-tab-${extension.id}`;
}

/** Test-only helper to reset the registry between test files. */
export function clearRepositorySectionExtensionsForTests() {
  registry.clear();
}
