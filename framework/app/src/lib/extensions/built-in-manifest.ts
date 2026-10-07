/**
 * Static manifest of built-in repository section extensions.
 *
 * This file intentionally contains **no runtime dependencies** (no React, no
 * renderer-only imports) so that the main process can read it while building
 * the application menu, while the renderer registers and renders the actual
 * extension components (see `extension-points.ts`).
 */
export interface IBuiltInExtensionManifestEntry {
  /** Unique, stable identifier (kebab-case), e.g. 'commits-filter'. */
  readonly id: string;

  /** Title shown on the repository tab and in the derived menu item. */
  readonly title: string;

  /** Accelerator for the "Show <title>" menu item ('' disables it). */
  readonly accelerator: string;
}

export const builtInExtensions: ReadonlyArray<IBuiltInExtensionManifestEntry> =
  [{ id: "commits-filter", title: "Commits", accelerator: "CmdOrCtrl+3" }];

/** The `MenuIDs` / `MenuEvent` values contributed by the built-in extensions. */
export const extensionMenuIds: ReadonlyArray<`show-extension-${string}`> =
  builtInExtensions.map(
    (e) => `show-extension-${e.id}` as `show-extension-${string}`
  );

/** Menu item descriptors (labels/ids/accelerators) for all extensions. */
export function getExtensionMenuItems(): ReadonlyArray<{
  readonly label: string;
  readonly id: string;
  readonly accelerator: string;
}> {
  return builtInExtensions.map((e) => ({
    label: `Show ${e.title}`,
    id: `show-extension-${e.id}`,
    accelerator: e.accelerator,
  }));
}
