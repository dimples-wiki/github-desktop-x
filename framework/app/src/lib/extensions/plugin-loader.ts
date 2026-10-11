import { ipcRenderer } from 'electron'

import * as React from 'react'
import classNames from 'classnames'
import * as octicons from '../../ui/octicons/octicons.generated'
import { PopupType } from '../../models/popup'
import { CommitList } from '../../ui/history/commit-list'
import { ChangedFile } from '../../ui/changes/changed-file'
import { TextBox } from '../../ui/lib/text-box'
import { Select } from '../../ui/lib/select'
import { Button } from '../../ui/lib/button'
import { Checkbox, CheckboxValue } from '../../ui/lib/checkbox'
import {
  Popover,
  PopoverAnchorPosition,
  PopoverDecoration,
} from '../../ui/lib/popover'
import { DiffSelectionType } from '../../models/diff'
import { Octicon } from '../../ui/octicons'
import { defaultErrorHandler, Dispatcher } from '../../ui/dispatcher'
import { Repository } from '../../models/repository'
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
/** 由 ui/index.tsx 在创建应用 dispatcher 后注册（实例非模块导出）。 */
let extensionDispatcher: Dispatcher | null = null

/** ui/index.tsx 调用：向插件暴露受控的宿主动作。 */
export function registerExtensionDispatcher(d: Dispatcher) {
  extensionDispatcher = d
}

function assembleExtensionApi() {
  return {
    /** Runtime platform flag (plugins must not rely on webpack globals). */
    isDarwin: process.platform === 'darwin',
    CheckboxValue,
    DiffSelectionType,
    Popover,
    PopoverAnchorPosition,
    PopoverDecoration,
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
      ChangedFile,
      TextBox,
      Select,
      Button,
      Checkbox,
      Octicon,
    },

    /** Curated host actions. Repository-scoped; plugins pass their own
     *  repository (available via slot props). */
    actions: {
      /** 弹出原生「放弃更改」确认弹窗（host 负责实际丢弃） */
      showDiscardChangesConfirmation: (
        repository: Repository,
        files: ReadonlyArray<any>
      ) => {
        if (extensionDispatcher === null) {
          log.warn('[extensions] dispatcher not registered yet')
          return
        }
        extensionDispatcher.showPopup({
          type: PopupType.ConfirmDiscardChanges,
          repository,
          files,
        })
      },
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
    (
      _event,
      payload: { plugins: ReadonlyArray<{ id: string; code: string }> }
    ) => {
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
            `[extensions] loaded plugin: ${
              plugin.id
            } (${getExtensionRegistrySizes()})`
          )
        } catch (error) {
          log.error(`[extensions] failed to load plugin: ${plugin.id}`, error)
        }
      }
    }
  )

  ipcRenderer.send(ReadyChannel)
}
