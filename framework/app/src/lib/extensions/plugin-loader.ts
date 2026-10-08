import { ipcRenderer } from 'electron'

import * as React from 'react'
import classNames from 'classnames'
import * as octicons from '../../ui/octicons/octicons.generated'
import { PopupType } from '../../models/popup'
import { CommitList } from '../../ui/history/commit-list'
import { TextBox } from '../../ui/lib/text-box'
import { Select } from '../../ui/lib/select'
import { Button } from '../../ui/lib/button'
import { Checkbox, CheckboxValue } from '../../ui/lib/checkbox'
import { DiffSelectionType } from '../../models/diff'
import { Octicon } from '../../ui/octicons'
import { defaultErrorHandler } from '../../ui/dispatcher'
import {
  getExtensionRegistrySizes,
  registerRepositorySection,
  registerChangesFileView,
} from './extension-points'

/**
 * The API surface handed to dynamically loaded extension plugins.
 *
 * Everything a plugin needs from the app (host components, octicons, enums,
 * registration functions) is exposed here explicitly — plugins run in the
 * sandboxed renderer and deliberately have **no** other access to the app's
 * module graph.
 */
function assembleExtensionApi() {
  return {
    /** Runtime platform flag (plugins must not rely on webpack globals). */
    isDarwin: process.platform === 'darwin',
    CheckboxValue,
    DiffSelectionType,
    React,
    classNames,
    octicons,
    PopupType,
    defaultErrorHandler,
    registerRepositorySection,
    registerChangesFileView,

    /** Host building blocks plugins may reuse for a native look & feel. */
    components: {
      CommitList,
      TextBox,
      Select,
      Button,
      Checkbox,
      Octicon,
    },
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __GHD_EXTENSION_API__: Record<string, any> | undefined
}

/** The channel the main process uses to deliver compiled plugin bundles. */
const InstallChannel = 'extensions:install'
/** The renderer announces readiness on this channel (load-order handshake). */
const ReadyChannel = 'extensions:renderer-ready'

let initialized = false

/**
 * Arms the renderer side of the plugin system: exposes the extension API to
 * evaluated plugin bundles and listens for the install payload from the
 * plugin host. Called when the repository view mounts.
 */
export function initializeExtensionLoader() {
  if (initialized) {
    return
  }
  initialized = true

  globalThis.__GHD_EXTENSION_API__ = assembleExtensionApi()

  ipcRenderer.on(
    InstallChannel,
    (_event, payload: { plugins: ReadonlyArray<{ id: string; code: string }> }) => {
      for (const plugin of payload.plugins ?? []) {
        try {
          log.info(
            `[extensions] installing ${plugin.id}; code head: ${JSON.stringify(
              plugin.code.slice(0, 120)
            )}`
          )
          // The plugin bundle is an IIFE built against the API object.
          const run = new Function('__ghd', plugin.code)
          run(globalThis.__GHD_EXTENSION_API__)
          log.info(
            `[extensions] loaded plugin: ${plugin.id} (${getExtensionRegistrySizes()})`
          )
        } catch (error) {
          log.error(`[extensions] failed to load plugin: ${plugin.id}`, error)
        }
      }
    }
  )

  ipcRenderer.send(ReadyChannel)
}
