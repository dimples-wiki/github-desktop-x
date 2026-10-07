import { ipcMain, BrowserWindow } from 'electron'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'

import { app } from 'electron'
import {
  setInstalledExtensionManifests,
  IExtensionManifest,
} from '../../lib/extensions/extension-manifests'

/** A plugin discovered in the plugins directory. */
interface IInstalledPlugin {
  readonly manifest: IExtensionManifest
  /** The compiled renderer bundle (IIFE evaluated against the ext API). */
  readonly code: string
}

/**
 * Resolves the plugins directory: `<userData>/plugins`, overridable with the
 * `DIMPLE_PLUGINS_DIR` environment variable (useful for development).
 */
function getPluginsDirectory(): string {
  const override = process.env.DIMPLE_PLUGINS_DIR
  if (override !== undefined && override.length > 0) {
    return override
  }

  return join(app.getPath('userData'), 'plugins')
}

/**
 * Scans the plugins directory. Each plugin is a folder containing
 *
 *   plugin.json  — the manifest ({ id, title, accelerator })
 *   renderer.js  — the compiled renderer bundle (IIFE)
 */
function scanPlugins(directory: string): ReadonlyArray<IInstalledPlugin> {
  if (!existsSync(directory)) {
    return []
  }

  const plugins: IInstalledPlugin[] = []

  try {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue
      }

      const name = entry.name
      const pluginDir = join(directory, name)
      const manifestPath = join(pluginDir, 'plugin.json')
      const rendererPath = join(pluginDir, 'renderer.js')

      if (!existsSync(manifestPath) || !existsSync(rendererPath)) {
        continue
      }

      try {
        const manifest = JSON.parse(
          readFileSync(manifestPath, 'utf8')
        ) as IExtensionManifest

        if (
          typeof manifest.id !== 'string' ||
          typeof manifest.title !== 'string'
        ) {
          log.warn(`[extensions] skipping ${name}: invalid manifest`)
          continue
        }

        plugins.push({
          manifest: {
            id: manifest.id,
            title: manifest.title,
            accelerator: manifest.accelerator ?? '',
          },
          code: readFileSync(rendererPath, 'utf8'),
        })
      } catch (error) {
        log.error(`[extensions] failed to read plugin at ${pluginDir}`, error)
      }
    }
  } catch (error) {
    log.error(`[extensions] failed to scan ${directory}`, error)
  }

  return plugins
}

/**
 * Starts the extension host: discovers installed plugins, makes their
 * manifests known to the menu, delivers their renderer bundles to the
 * renderer once it announces readiness, and rebuilds the application menu
 * so plugin items appear without a restart.
 */
export function initializeExtensionHost() {
  const directory = getPluginsDirectory()
  const plugins = scanPlugins(directory)

  if (plugins.length === 0) {
    log.info(`[extensions] no plugins found in ${directory}`)
    return
  }

  setInstalledExtensionManifests(plugins.map(p => p.manifest))
  log.info(
    `[extensions] discovered ${plugins.length} plugin(s) from ${directory}`
  )

  ipcMain.on(ReadyChannel, () => {
    const window = BrowserWindow.getAllWindows()[0]
    if (window !== undefined) {
      window.webContents.send(
        InstallChannel,
        {
          plugins: plugins.map(p => ({ id: p.manifest.id, code: p.code })),
        }
      )
    }
  })

  // Rebuild the application menu so the plugins' "Show <title>" items and
  // accelerators show up. Reuses the existing rebuild-and-merge path.
  ipcMain.emit('update-preferred-app-menu-item-labels', null, {})
}

/** Channel names shared with the renderer-side plugin loader. */
const InstallChannel = 'extensions:install'
const ReadyChannel = 'extensions:renderer-ready'
