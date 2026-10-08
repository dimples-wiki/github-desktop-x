import { registerRepositorySection } from './ghd'
import { CommitsSidebar } from './commits-sidebar'
import { injectStyles } from './styles'

// Top-level side effects: the host evaluates this bundle exactly once via
// the plugin loader; everything the plugin does happens right here.
injectStyles()

registerRepositorySection({
  id: 'commits-filter',
  title: 'Commits',
  sidebarComponent: CommitsSidebar,
  refreshOnActivate: 'history',
})
