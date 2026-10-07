import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert'

import {
  clearExtensionsForTests,
  getExtensionForSection,
  getRegisteredChangesFileView,
  getRepositorySectionExtensions,
  getSectionForExtension,
  registerChangesFileView,
  registerRepositorySection,
  sectionForExtensionIndex,
  subscribeRepositorySectionExtensions,
} from '../../src/lib/extensions/extension-points'

const fakeSidebar = {} as any
const fakeView = {} as any

function makeExtension(id: string) {
  return { id, title: id, sidebarComponent: fakeSidebar, refreshOnActivate: 'history' as const }
}

describe('repository section extension registry', () => {
  beforeEach(() => {
    clearExtensionsForTests()
  })

  it('starts empty and notifies subscribers on registration', () => {
    let notifications = 0
    const unsubscribe = subscribeRepositorySectionExtensions(() => {
      notifications++
    })

    assert.strictEqual(getRepositorySectionExtensions().length, 0)

    registerRepositorySection(makeExtension('commits-filter'))

    assert.strictEqual(notifications, 1)
    assert.strictEqual(getRepositorySectionExtensions().length, 1)

    unsubscribe()
    registerRepositorySection(makeExtension('second'))
    assert.strictEqual(notifications, 1, 'unsubscribed listener not called')
  })

  it('rejects duplicate registrations', () => {
    registerRepositorySection(makeExtension('commits-filter'))
    assert.throws(
      () => registerRepositorySection(makeExtension('commits-filter')),
      /already registered/
    )
  })

  it('maps between extensions and stable section values', () => {
    const first = makeExtension('commits-filter')
    const second = makeExtension('second')
    registerRepositorySection(first)
    registerRepositorySection(second)

    assert.strictEqual(getSectionForExtension(first), sectionForExtensionIndex(0))
    assert.strictEqual(getSectionForExtension(second), sectionForExtensionIndex(1))
    assert.strictEqual(getExtensionForSection(sectionForExtensionIndex(0)), first)
    assert.strictEqual(getExtensionForSection(sectionForExtensionIndex(1)), second)
  })

  it('returns no extension for built-in sections', () => {
    registerRepositorySection(makeExtension('commits-filter'))
    assert.strictEqual(getExtensionForSection(0 as any), undefined)
    assert.strictEqual(getExtensionForSection(1 as any), undefined)
    assert.strictEqual(getExtensionForSection(999 as any), undefined)
  })
})

describe('changes file view registry', () => {
  beforeEach(() => {
    clearExtensionsForTests()
  })

  it('replaces the previously registered view', () => {
    registerChangesFileView({ id: 'a', title: 'A', component: fakeView })
    assert.strictEqual(getRegisteredChangesFileView()?.id, 'a')

    registerChangesFileView({ id: 'b', title: 'B', component: fakeView })
    assert.strictEqual(getRegisteredChangesFileView()?.id, 'b')
    assert.strictEqual(getRepositorySectionExtensions().length, 0)
  })
})
