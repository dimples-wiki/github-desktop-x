/** The plugin-facing API bridge (see commits-filter/src/ghd.ts). */
declare var globalThis: any

const api: any = globalThis.__GHD_EXTENSION_API__

export const React = api.React
export const components = api.components
export const octicons = api.octicons
export const Popover = api.Popover
export const PopoverAnchorPosition = api.PopoverAnchorPosition
export const PopoverDecoration = api.PopoverDecoration
export const CheckboxValue = api.CheckboxValue
export const DiffSelectionType = api.DiffSelectionType
export const registerChangesFileView = api.registerChangesFileView
