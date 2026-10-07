/** The plugin-facing API bridge (see commits-filter/src/ghd.ts). */
declare var globalThis: any

const api: any = globalThis.__GHD_EXTENSION_API__

export const React = api.React
export const registerChangesFileView = api.registerChangesFileView
