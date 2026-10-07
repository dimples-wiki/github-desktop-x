import { Commit } from '../../models/commit'

/**
 * The active filter of the Commits tab.
 *
 * Every dimension is optional in the sense that an "empty" value means
 * "no constraint". Dimensions combine with AND while terms inside a
 * dimension combine with OR (currently at most one author is selected)
 * — see `filterCommits`.
 */
export interface ICommitFilter {
  /** Emails (lower-cased) of the authors to include. Empty means all authors. */
  readonly authorEmails: ReadonlyArray<string>

  /**
   * Terms which must all appear (case-insensitively, as substrings) in the
   * commit summary. This gives a forgiving "fuzzy" search where the entered
   * words can occur anywhere and in any order.
   */
  readonly messageTerms: ReadonlyArray<string>

  /** Case-insensitive substring to find in the commit body (description). */
  readonly descriptionTerm: string

  /** Inclusive lower bound for the author date as `YYYY-MM-DD`, or null. */
  readonly dateFrom: string | null

  /** Inclusive upper bound for the author date as `YYYY-MM-DD`, or null. */
  readonly dateTo: string | null
}

/** A filter which does not constrain the commit list at all. */
export const EmptyCommitFilter: ICommitFilter = {
  authorEmails: [],
  messageTerms: [],
  descriptionTerm: '',
  dateFrom: null,
  dateTo: null,
}

/** An author of one or more commits, deduplicated by email. */
export interface ICommitAuthor {
  readonly name: string
  /** The lower-cased email address (used as the stable identifier). */
  readonly email: string
}

/** Whether the filter constrains the commit list in any dimension. */
export function isEmptyCommitFilter(filter: ICommitFilter): boolean {
  return (
    filter.authorEmails.length === 0 &&
    filter.messageTerms.length === 0 &&
    filter.descriptionTerm.trim().length === 0 &&
    filter.dateFrom === null &&
    filter.dateTo === null
  )
}

/**
 * Parses a date string in the `YYYY-MM-DD` format into a local-time `Date`
 * at midnight. Returns `null` for anything which is not a valid calendar
 * date (including empty strings, garbage, and dates like `2026-02-30`).
 */
export function parseDateString(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())

  if (match === null) {
    return null
  }

  const year = parseInt(match[1], 10)
  const month = parseInt(match[2], 10)
  const day = parseInt(match[3], 10)

  const date = new Date(year, month - 1, day)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

/** Whether the given value is an empty or still-valid `YYYY-MM-DD` input. */
export function isValidDateString(value: string): boolean {
  return value.trim().length === 0 || parseDateString(value) !== null
}

/** The list of distinct commit authors, deduplicated by (lower-cased) email. */
export function getCommitAuthors(
  commits: ReadonlyArray<Commit>
): ReadonlyArray<ICommitAuthor> {
  const authorsByEmail = new Map<string, ICommitAuthor>()

  for (const commit of commits) {
    const email = commit.author.email.toLowerCase()
    const existing = authorsByEmail.get(email)

    if (existing === undefined) {
      authorsByEmail.set(email, {
        name: commit.author.name,
        email,
      })
    }
  }

  return [...authorsByEmail.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  )
}

/** The inclusive start (local midnight) of the given `YYYY-MM-DD` day. */
function startOfDay(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0,
    0
  ).getTime()
}

/** The inclusive end (local end of day) of the given `YYYY-MM-DD` day. */
function endOfDay(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999
  ).getTime()
}

/** Whether the commit's author date falls into the given (inclusive) range. */
function matchesDateRange(
  commit: Commit,
  from: Date | null,
  to: Date | null
): boolean {
  // The commit list renders the author date, so that's the date to filter on.
  const timestamp = commit.author.date.getTime()

  if (from !== null && timestamp < startOfDay(from)) {
    return false
  }

  if (to !== null && timestamp > endOfDay(to)) {
    return false
  }

  return true
}

/** Whether every term occurs (case-insensitively) in the given haystack. */
function matchesAllTerms(
  haystack: string,
  terms: ReadonlyArray<string>
): boolean {
  const lowered = haystack.toLowerCase()

  return terms.every(term => lowered.includes(term.toLowerCase()))
}

/**
 * Returns the subset of commits matching all active filter dimensions.
 *
 * - authors: OR over the selected emails
 * - message terms: AND over all terms (fuzzy substring search)
 * - description: single case-insensitive substring
 * - date range: inclusive bounds on the author date (local time)
 */
export function filterCommits(
  commits: ReadonlyArray<Commit>,
  filter: ICommitFilter
): ReadonlyArray<Commit> {
  const descriptionTerm = filter.descriptionTerm.trim().toLowerCase()
  const authorEmails = filter.authorEmails.map(email => email.toLowerCase())
  const dateFrom = filter.dateFrom !== null ? parseDateString(filter.dateFrom) : null
  const dateTo = filter.dateTo !== null ? parseDateString(filter.dateTo) : null

  return commits.filter(commit => {
    if (
      authorEmails.length > 0 &&
      !authorEmails.includes(commit.author.email.toLowerCase())
    ) {
      return false
    }

    if (
      filter.messageTerms.length > 0 &&
      !matchesAllTerms(commit.summary, filter.messageTerms)
    ) {
      return false
    }

    if (
      descriptionTerm.length > 0 &&
      !commit.body.toLowerCase().includes(descriptionTerm)
    ) {
      return false
    }

    if (!matchesDateRange(commit, dateFrom, dateTo)) {
      return false
    }

    return true
  })
}
