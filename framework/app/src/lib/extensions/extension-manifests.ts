/**
 * Registry of extension manifests known to the app.
 *
 * The **main process** seeds this store from the plugins directory (see
 * plugin-host) and the menu code reads it when building the application
 * menu, so dynamically installed plugins get their "Show <title>" items and
 * accelerators without any restart. Zero dependencies — safe for both
 * processes.
 */
export interface IExtensionManifest {
  /** Unique, stable identifier (kebab-case), e.g. 'commits-filter'. */
  readonly id: string

  /** Title shown on the repository tab and in the derived menu item. */
  readonly title: string

  /** Accelerator for the "Show <title>" menu item ('' disables it). */
  readonly accelerator: string
}

let installedManifests: ReadonlyArray<IExtensionManifest> = []

/** Replaces the set of manifests discovered in the plugins directory. */
export function setInstalledExtensionManifests(
  manifests: ReadonlyArray<IExtensionManifest>
) {
  installedManifests = manifests
}

/** All known extension manifests (empty until plugins are discovered). */
export function getKnownExtensionManifests(): ReadonlyArray<IExtensionManifest> {
  return installedManifests
}

/** Menu item descriptors (labels/ids/accelerators) for all known plugins. */
export function getExtensionMenuItems(): ReadonlyArray<{
  readonly label: string
  readonly id: string
  readonly accelerator: string
}> {
  return installedManifests.map(e => ({
    label: `Show ${e.title}`,
    id: `show-extension-${e.id}`,
    accelerator: e.accelerator,
  }))
}

/** The `MenuIDs`/`MenuEvent` values contributed by all known plugins. */
export function getExtensionMenuIds(): ReadonlyArray<`show-extension-${string}`> {
  return installedManifests.map(
    e => `show-extension-${e.id}` as `show-extension-${string}`
  )
}
