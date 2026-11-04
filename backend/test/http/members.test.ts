import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { ProjectModel } from '../../src/data/models/project.ts'
import { UserModel } from '../../src/data/models/user.ts'
import { clearDatabase, startDatabase, stopDatabase } from '../database.ts'
import { api } from './api.ts'

// A lab with a project admin and a member, and a site admin who isn't in it
const ids = { admin: '', member: '', siteAdmin: '' }
const NEWCOMER = '0000-0001-5109-3700'

beforeAll(startDatabase)
afterAll(stopDatabase)

// A fresh lab for each test
beforeEach(async () => {
  await clearDatabase()
  const [admin, member, siteAdmin] = await UserModel.create([
    { orcid: '0000-0002-1825-0097', name: 'Ada Admin', lastSignedInAt: new Date() },
    { orcid: '0000-0002-1694-233X', name: 'Mo Member', lastSignedInAt: new Date() },
    { orcid: '0000-0001-5000-0007', name: 'Sam Site', siteAdmin: true },
  ])
  ids.admin = admin!._id.toHexString()
  ids.member = member!._id.toHexString()
  ids.siteAdmin = siteAdmin!._id.toHexString()
  await ProjectModel.create({
    code: 'LAB',
    title: 'Lab',
    members: [
      { userId: admin!._id, role: 'admin' },
      { userId: member!._id, role: 'member' },
    ],
  })
})

const put = (orcid: string, as: string, role: string) =>
  api().put(`/api/v1/projects/LAB/members/${orcid}`).set('X-Test-User', as).send({ role })

describe('project members', () => {
  it('lists the members for the project’s admins, admins first', async () => {
    const response = await api().get('/api/v1/projects/LAB/members').set('X-Test-User', ids.admin)

    expect(response.status).toBe(200)
    expect(response.body).toEqual([
      {
        name: 'Ada Admin',
        orcid: '0000-0002-1825-0097',
        orcidUrl: 'https://orcid.org/0000-0002-1825-0097',
        signedIn: true,
        role: 'admin',
      },
      expect.objectContaining({ name: 'Mo Member', role: 'member' }),
    ])
  })

  it('hides the members from everyone but its admins and site admins', async () => {
    const member = await api().get('/api/v1/projects/LAB/members').set('X-Test-User', ids.member)
    const anyone = await api().get('/api/v1/projects/LAB/members')
    const siteAdmin = await api()
      .get('/api/v1/projects/LAB/members')
      .set('X-Test-User', ids.siteAdmin)

    expect(member.status).toBe(403)
    expect(anyone.status).toBe(401)
    expect(siteAdmin.status).toBe(200)
  })

  it('adds someone who has never signed in, named by their ORCID iD until they do', async () => {
    const response = await put(NEWCOMER, ids.admin, 'viewer')

    expect(response.status).toBe(200)
    expect(response.body).toContainEqual(
      expect.objectContaining({ name: NEWCOMER, orcid: NEWCOMER, signedIn: false, role: 'viewer' }),
    )
  })

  it('changes a role, and takes it away', async () => {
    const changed = await put('0000-0002-1694-233X', ids.admin, 'viewer')
    const removed = await api()
      .delete('/api/v1/projects/LAB/members/0000-0002-1694-233X')
      .set('X-Test-User', ids.admin)

    expect(changed.body).toContainEqual(
      expect.objectContaining({ name: 'Mo Member', role: 'viewer' }),
    )
    expect(removed.status).toBe(200)
    expect(removed.body.map((m: { name: string }) => m.name)).toEqual(['Ada Admin'])
  })

  it('leaves the project admin role to site admins', async () => {
    const byAdmin = await put(NEWCOMER, ids.admin, 'admin')
    const bySiteAdmin = await put(NEWCOMER, ids.siteAdmin, 'admin')

    expect(byAdmin.status).toBe(403)
    expect(byAdmin.body.error).toBe('Only site admins can give or take away the project admin role')
    expect(bySiteAdmin.status).toBe(200)
  })

  it('keeps at least one admin', async () => {
    const response = await api()
      .delete('/api/v1/projects/LAB/members/0000-0002-1825-0097')
      .set('X-Test-User', ids.siteAdmin)

    expect(response.status).toBe(409)
  })

  it('refuses something that is not an ORCID iD, and a role that does not exist', async () => {
    const badOrcid = await put('0000-0000-0000-0000', ids.admin, 'viewer')
    const badRole = await put(NEWCOMER, ids.admin, 'owner')

    expect(badOrcid.status).toBe(422)
    expect(badOrcid.body.problems[0].path).toBe('orcid')
    expect(badRole.status).toBe(422)
    expect(badRole.body.problems[0].path).toBe('role')
  })

  it('says who is not a member, when asked to remove them', async () => {
    const response = await api()
      .delete(`/api/v1/projects/LAB/members/${NEWCOMER}`)
      .set('X-Test-User', ids.admin)

    expect(response.status).toBe(404)
  })
})
