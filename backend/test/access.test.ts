import { describe, expect, it } from 'vitest'

import {
  canContribute,
  canEditEntry,
  canManageMembers,
  canRead,
  roleIn,
  type CurrentUser,
} from '../src/access.ts'

function user(id: string, siteAdmin = false): CurrentUser {
  return { id, orcid: '0000-0002-1825-0097', name: id, siteAdmin }
}

const project = {
  publicRead: false,
  members: [
    { userId: 'a', role: 'admin' },
    { userId: 'm', role: 'contributor' },
    { userId: 'v', role: 'viewer' },
  ],
}

describe('access rules', () => {
  it('finds a member’s role', () => {
    expect(roleIn(project, user('m'))).toBe('contributor')
    expect(roleIn(project, user('x'))).toBeNull()
    expect(roleIn(project, null)).toBeNull()
  })

  it.each([
    ['anyone', null, false, false],
    ['an outsider', user('x'), false, false],
    ['a viewer', user('v'), true, false],
    ['a contributor', user('m'), true, true],
    ['an admin', user('a'), true, true],
    ['a site admin', user('s', true), true, true],
  ])('lets %s read (%s) and contribute (%s)', (_who, who, read, contribute) => {
    expect(canRead(project, who, true)).toBe(read)
    expect(canContribute(project, who)).toBe(contribute)
  })

  it('lets anyone read a public project, but not contribute to it', () => {
    const open = { ...project, publicRead: true }

    expect(canRead(open, null, true)).toBe(true)
    expect(canContribute(open, null)).toBe(false)
  })

  it('lets only members and site admins read a public project, if the site is not public', () => {
    const open = { ...project, publicRead: true }

    expect(canRead(open, null, false)).toBe(false)
    expect(canRead(open, user('x'), false)).toBe(false)
    expect(canRead(open, user('v'), false)).toBe(true)
    expect(canRead(open, user('s', true), false)).toBe(true)
  })

  it('lets only admins and site admins manage members', () => {
    expect(canManageMembers(project, user('a'))).toBe(true)
    expect(canManageMembers(project, user('x', true))).toBe(true)
    expect(canManageMembers(project, user('m'))).toBe(false)
    expect(canManageMembers(project, null)).toBe(false)
  })

  it('lets only an entry’s authors edit it, while they can contribute and it is not signed', () => {
    const entry = { authorId: 'm', coAuthorIds: ['v'], status: 'draft' }

    expect(canEditEntry(entry, project, user('m'))).toBe(true)
    expect(canEditEntry(entry, project, user('a'))).toBe(false)
    // A co-author who is now only a viewer
    expect(canEditEntry(entry, project, user('v'))).toBe(false)
    expect(canEditEntry({ ...entry, status: 'signed' }, project, user('m'))).toBe(false)
    expect(canEditEntry(entry, project, null)).toBe(false)
  })
})
