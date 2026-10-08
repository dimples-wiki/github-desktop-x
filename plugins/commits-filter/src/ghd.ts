/**
 * The plugin-facing API bridge.
 *
 * The plugin loader (framework/app/src/lib/extensions/plugin-loader.ts)
 * exposes the host application's building blocks on `globalThis` right
 * before evaluating this bundle, so the plugin never imports app modules
 * directly — everything crosses this explicit boundary.
 */

/* eslint-disable no-var */
declare var globalThis: any

const api: any = globalThis.__GHD_EXTENSION_API__

/** The host renderer's React (for the classic JSX factory binding). */
export const React = api.React
export const classNames = api.classNames
/** Host components and helpers, octicons, enums and registration functions. */
export const components = api.components
export const octicons = api.octicons
export const PopupType = api.PopupType
export const Popover = api.Popover
export const PopoverAnchorPosition = api.PopoverAnchorPosition
export const PopoverDecoration = api.PopoverDecoration
export const defaultErrorHandler = api.defaultErrorHandler
export const registerRepositorySection = api.registerRepositorySection
export const registerChangesFileView = api.registerChangesFileView
export default api

