/**
 * The list of built-in repository section extensions. Adding a new extension
 * is a two-line change here (plus its own module under `built-in/` and an
 * entry in `built-in-manifest.ts`); no upstream file needs to change.
 */
import { register } from './commits-filter'

register()
