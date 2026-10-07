import {
  registerRepositorySection,
} from '../extension-points'
import { CommitsSidebar } from '../../../ui/history/commits-sidebar'

/**
 * Registers the "Commits" section extension: the history commit list with
 * client-side filtering (author / message / description / date range).
 */
export function register() {
  registerRepositorySection({
    id: 'commits-filter',
    title: 'Commits',
    sidebarComponent: CommitsSidebar,
    refreshOnActivate: 'history',
  })
}
