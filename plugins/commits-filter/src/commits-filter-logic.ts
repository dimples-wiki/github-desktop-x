/**
 * Pure filtering logic of the commits-filter plugin.
 *
 * No React / no host imports — fully unit-testable in isolation.
 */

/** The active filter of the Commits tab. */
export interface ICommitFilter {
  /** Emails (lower-cased) of the authors to include. Empty means all authors. */
  readonly authorEmails: ReadonlyArray<string>

  /**
   * Terms which must all appear (case-insensitively, as substrings) in the
   * commit summary — a forgiving "fuzzy" AND search.
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
 * at midnight. Returns `null` for anything that is not a valid calendar date.
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
  commits: ReadonlyArray<any>
): ReadonlyArray<ICommitAuthor> {
  const authorsByEmail = new Map<string, ICommitAuthor>()

  for (const commit of commits) {
    const email = commit.author.email.toLowerCase()
    if (!authorsByEmail.has(email)) {
      authorsByEmail.set(email, { name: commit.author.name, email })
    }
  }

  return [...authorsByEmail.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  )
}

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

function matchesDateRange(
  commit: any,
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

function matchesAllTerms(haystack: string, terms: ReadonlyArray<string>) {
  const lowered = haystack.toLowerCase()
  return terms.every(term => lowered.includes(term.toLowerCase()))
}

/**
 * Returns the subset of commits matching all active filter dimensions
 * (authors OR-combined, message terms AND-combined, description substring,
 * inclusive author-date range).
 */
export function filterCommits(
  commits: ReadonlyArray<any>,
  filter: ICommitFilter
): ReadonlyArray<any> {
  const descriptionTerm = filter.descriptionTerm.trim().toLowerCase()
  const authorEmails = filter.authorEmails.map(email => email.toLowerCase())
  const dateFrom =
    filter.dateFrom !== null ? parseDateString(filter.dateFrom) : null
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
      !String(commit.body ?? '').toLowerCase().includes(descriptionTerm)
    ) {
      return false
    }

    if (!matchesDateRange(commit, dateFrom, dateTo)) {
      return false
    }

    return true
  })
}
