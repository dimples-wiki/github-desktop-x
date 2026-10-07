import { describe, it } from 'node:test'
import assert from 'node:assert'

import {
  EmptyCommitFilter,
  filterCommits,
  getCommitAuthors,
  isEmptyCommitFilter,
  isValidDateString,
  parseDateString,
} from '../src/commits-filter-logic'

let counter = 0

function createCommit(
  summary: string,
  body: string = '',
  authorName: string = 'Yoko Tanaka',
  authorEmail: string = 'yoko@example.com',
  date: Date = new Date(2026, 5, 15, 12, 0, 0)
) {
  counter++
  const author = { name: authorName, email: authorEmail, date }

  return {
    sha: `sha${counter}`,
    summary,
    body,
    author,
    committer: author,
  }
}

function summaryOf(commits: ReadonlyArray<any>): string[] {
  return commits.map(c => c.summary)
}

describe('parseDateString', () => {
  it('parses valid dates in local time', () => {
    const date = parseDateString('2026-10-07')
    assert.notStrictEqual(date, null)
    assert.strictEqual(date!.getFullYear(), 2026)
    assert.strictEqual(date!.getMonth(), 9)
    assert.strictEqual(date!.getDate(), 7)
  })

  it('rejects garbage, empty values, and impossible dates', () => {
    assert.strictEqual(parseDateString(''), null)
    assert.strictEqual(parseDateString('not a date'), null)
    assert.strictEqual(parseDateString('2026-13-01'), null)
    assert.strictEqual(parseDateString('2026-02-30'), null)
    assert.strictEqual(parseDateString('2026-10-07T10:00'), null)
  })

  it('accepts surrounding whitespace', () => {
    assert.notStrictEqual(parseDateString(' 2026-10-07 '), null)
  })
})

describe('isValidDateString', () => {
  it('treats empty values as valid (no constraint yet)', () => {
    assert.strictEqual(isValidDateString(''), true)
    assert.strictEqual(isValidDateString('   '), true)
  })

  it('accepts valid dates and rejects invalid ones', () => {
    assert.strictEqual(isValidDateString('2026-10-07'), true)
    assert.strictEqual(isValidDateString('2026-02-30'), false)
    assert.strictEqual(isValidDateString('foo'), false)
  })
})

describe('isEmptyCommitFilter', () => {
  it('detects the empty filter', () => {
    assert.strictEqual(isEmptyCommitFilter(EmptyCommitFilter), true)
  })

  it('detects filters with any active dimension', () => {
    assert.strictEqual(
      isEmptyCommitFilter({ ...EmptyCommitFilter, messageTerms: ['fix'] }),
      false
    )
    assert.strictEqual(
      isEmptyCommitFilter({ ...EmptyCommitFilter, authorEmails: ['a@b.c'] }),
      false
    )
    assert.strictEqual(
      isEmptyCommitFilter({ ...EmptyCommitFilter, descriptionTerm: ' x ' }),
      false
    )
    assert.strictEqual(
      isEmptyCommitFilter({ ...EmptyCommitFilter, dateFrom: '2026-01-01' }),
      false
    )
    assert.strictEqual(
      isEmptyCommitFilter({ ...EmptyCommitFilter, dateTo: '2026-01-01' }),
      false
    )
  })
})

describe('getCommitAuthors', () => {
  it('deduplicates authors by email regardless of case', () => {
    const commits = [
      createCommit('a', '', 'Yoko Tanaka', 'yoko@example.com'),
      createCommit('b', '', 'Yoko Tanaka', 'YOKO@EXAMPLE.COM'),
      createCommit('c', '', 'Alex Chen', 'alex@example.com'),
    ]

    const authors = getCommitAuthors(commits)

    assert.strictEqual(authors.length, 2)
    assert.deepStrictEqual(
      authors.map(a => a.email),
      ['alex@example.com', 'yoko@example.com']
    )
  })

  it('returns an empty list for an empty commit list', () => {
    assert.deepStrictEqual(getCommitAuthors([]), [])
  })
})

describe('filterCommits', () => {
  const commits = [
    createCommit(
      'Fix pagination bug',
      'Scrolling loaded twice.',
      'Yoko Tanaka',
      'yoko@example.com',
      new Date(2026, 5, 1, 9, 0, 0)
    ),
    createCommit(
      'Add unit test',
      'Introduce the first test.',
      'Alex Chen',
      'alex@example.com',
      new Date(2026, 6, 15, 10, 0, 0)
    ),
    createCommit(
      'Update notes',
      'Refactor the parser for speed.',
      'Maria García',
      'maria@example.com',
      new Date(2026, 7, 20, 11, 0, 0)
    ),
    createCommit(
      'fix regression in history',
      '',
      'Alex Chen',
      'alex@example.com',
      new Date(2026, 8, 30, 23, 0, 0)
    ),
  ]

  it('passes everything through for the empty filter', () => {
    assert.strictEqual(filterCommits(commits, EmptyCommitFilter).length, 4)
  })

  it('filters by author email case-insensitively', () => {
    const filtered = filterCommits(commits, {
      ...EmptyCommitFilter,
      authorEmails: ['ALEX@EXAMPLE.COM'],
    })

    assert.deepStrictEqual(summaryOf(filtered), [
      'Add unit test',
      'fix regression in history',
    ])
  })

  it('matches message terms case-insensitively', () => {
    const filtered = filterCommits(commits, {
      ...EmptyCommitFilter,
      messageTerms: ['fix'],
    })

    assert.deepStrictEqual(summaryOf(filtered), [
      'Fix pagination bug',
      'fix regression in history',
    ])
  })

  it('requires every message term to match (AND, any order)', () => {
    const matching = filterCommits(commits, {
      ...EmptyCommitFilter,
      messageTerms: ['regression', 'history'],
    })

    assert.deepStrictEqual(summaryOf(matching), ['fix regression in history'])

    const notMatching = filterCommits(commits, {
      ...EmptyCommitFilter,
      messageTerms: ['fix', 'parser'],
    })

    assert.strictEqual(notMatching.length, 0)
  })

  it('searches the description (body) but not the summary', () => {
    const filtered = filterCommits(commits, {
      ...EmptyCommitFilter,
      descriptionTerm: 'parser',
    })

    assert.deepStrictEqual(summaryOf(filtered), ['Update notes'])

    const summaryTerm = filterCommits(commits, {
      ...EmptyCommitFilter,
      descriptionTerm: 'pagination',
    })

    assert.strictEqual(summaryTerm.length, 0)
  })

  it('filters by an inclusive date range on the author date', () => {
    const filtered = filterCommits(commits, {
      ...EmptyCommitFilter,
      dateFrom: '2026-06-01',
      dateTo: '2026-07-15',
    })

    assert.deepStrictEqual(summaryOf(filtered), [
      'Fix pagination bug',
      'Add unit test',
    ])
  })

  it('supports open-ended ranges', () => {
    const sinceAugust = filterCommits(commits, {
      ...EmptyCommitFilter,
      dateFrom: '2026-08-01',
    })

    assert.deepStrictEqual(summaryOf(sinceAugust), [
      'Update notes',
      'fix regression in history',
    ])

    const untilJuly = filterCommits(commits, {
      ...EmptyCommitFilter,
      dateTo: '2026-07-31',
    })

    assert.deepStrictEqual(summaryOf(untilJuly), [
      'Fix pagination bug',
      'Add unit test',
    ])
  })

  it('ignores invalid date bounds instead of failing', () => {
    const filtered = filterCommits(commits, {
      ...EmptyCommitFilter,
      dateFrom: 'not-a-date',
      dateTo: '2026-02-30',
    })

    assert.strictEqual(filtered.length, 4)
  })

  it('combines all dimensions with AND', () => {
    const filtered = filterCommits(commits, {
      ...EmptyCommitFilter,
      authorEmails: ['alex@example.com'],
      messageTerms: ['fix'],
      dateFrom: '2026-09-01',
    })

    assert.deepStrictEqual(summaryOf(filtered), ['fix regression in history'])
  })
})
