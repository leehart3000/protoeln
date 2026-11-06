import type { Response } from 'express'

import { canContribute, canRead, type CurrentUser, type ProjectAccess } from '../access.ts'
import { ForbiddenError, InvalidError, NotFoundError, UnauthorizedError } from '../errors.ts'

// Who made the request, as worked out by the app's authenticate option (see app.ts)
export function userOf(res: Response): CurrentUser | null {
  return (res.locals.user as CurrentUser | null | undefined) ?? null
}

// Whether the site lets anyone read its public projects (PROTOELN_PUBLIC_READ), as set by
// createApp in app.ts
export function sitePublicRead(res: Response): boolean {
  return res.locals.sitePublicRead === true
}

export function requireUser(res: Response): CurrentUser {
  const user = userOf(res)
  if (user === null) {
    throw new UnauthorizedError('Sign in to do this')
  }
  return user
}

// People who can't read a project are told it was not found, so private projects don't
// reveal that they exist
export function checkCanRead(res: Response, project: ProjectAccess) {
  if (!canRead(project, userOf(res), sitePublicRead(res))) {
    throw new NotFoundError('Project not found')
  }
}

export function checkCanContribute(res: Response, project: ProjectAccess) {
  checkCanRead(res, project)
  if (!canContribute(project, requireUser(res))) {
    throw new ForbiddenError("Only the project's contributors and admins can do this")
  }
}

// Reads a request body's fields, collecting every problem rather than stopping at the first
export class BodyReader {
  readonly problems: { path: string; message: string }[] = []
  private readonly body: Record<string, unknown>

  constructor(body: unknown) {
    this.body = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
  }

  // A required text field, which must not be empty
  text(field: string): string {
    const value = this.body[field]
    if (typeof value !== 'string' || value.trim() === '') {
      this.problems.push({ path: field, message: 'should be text that is not empty' })
      return ''
    }
    return value
  }

  // An optional text field, which may be empty
  optionalText(field: string): string | undefined {
    const value = this.body[field]
    if (value === undefined) return undefined
    if (typeof value !== 'string') {
      this.problems.push({ path: field, message: 'should be text' })
      return undefined
    }
    return value
  }

  // A required text field that must match a pattern, described in `rule` if it doesn't
  matching(field: string, pattern: RegExp, rule: string): string {
    const value = this.body[field]
    if (typeof value !== 'string' || !pattern.test(value)) {
      this.problems.push({ path: field, message: rule })
      return ''
    }
    return value
  }

  // An optional true-or-false field, which is `fallback` if it's left out
  optionalBoolean(field: string, fallback: boolean): boolean {
    const value = this.body[field]
    if (value === undefined) return fallback
    if (typeof value !== 'boolean') {
      this.problems.push({ path: field, message: 'should be true or false' })
      return fallback
    }
    return value
  }

  // A required true-or-false field
  boolean(field: string): boolean {
    const value = this.body[field]
    if (typeof value !== 'boolean') {
      this.problems.push({ path: field, message: 'should be true or false' })
      return false
    }
    return value
  }

  // A required list of positions, such as [2, 0, 1] (see stepsOf in @protoeln/content)
  indexPath(field: string): number[] {
    const value = this.body[field]
    if (
      !Array.isArray(value) ||
      value.length === 0 ||
      !value.every((index) => Number.isInteger(index) && index >= 0)
    ) {
      this.problems.push({ path: field, message: 'should be a list of whole numbers, 0 or more' })
      return []
    }
    return value as number[]
  }

  oneOf<T extends string>(field: string, allowed: readonly T[]): T {
    const value = this.body[field]
    if (!allowed.includes(value as T)) {
      this.problems.push({ path: field, message: `should be one of: ${allowed.join(', ')}` })
    }
    return value as T
  }

  date(field: string): Date {
    const value = this.body[field]
    const date = typeof value === 'string' ? new Date(value) : new Date(NaN)
    if (Number.isNaN(date.getTime())) {
      this.problems.push({ path: field, message: 'should be a date and time (ISO 8601)' })
    }
    return date
  }

  raw(field: string): unknown {
    return this.body[field]
  }

  // Throws if any field had a problem
  done() {
    if (this.problems.length > 0) {
      throw new InvalidError('The request has problems', this.problems)
    }
  }
}
