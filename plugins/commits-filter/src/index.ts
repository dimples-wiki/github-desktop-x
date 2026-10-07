import { registerRepositorySection } from './ghd'
import { CommitsSidebar } from './commits-sidebar'

registerRepositorySection({
  id: 'commits-filter',
  title: 'Commits',
  sidebarComponent: CommitsSidebar,
  refreshOnActivate: 'history',
})
