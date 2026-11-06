import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ProjectModel } from '../../src/data/models/project.ts'
import { UserModel } from '../../src/data/models/user.ts'
import { startDatabase, stopDatabase } from '../database.ts'
import { api } from './api.ts'

// The read-only lock (PROTOELN_READ_ONLY): everything can be read, nothing changed
let adminId = ''

beforeAll(async () => {
  await startDatabase()
  const admin = await UserModel.create({
    orcid: '0000-0002-1825-0097',
    name: 'Site admin',
    siteAdmin: true,
  })
  adminId = admin._id.toHexString()
  await ProjectModel.create({ code: 'LAB', title: 'A lab', members: [] })
})
afterAll(stopDatabase)

describe('the read-only lock', () => {
  it('refuses every change, even from a site admin, with 423 Locked', async () => {
    const response = await api({ readOnly: true })
      .post('/api/v1/projects')
      .set('X-Test-User', adminId)
      .send({ code: 'NEW', title: 'A new project' })

    expect(response.status).toBe(423)
    expect(response.body).toEqual({
      error: 'This site is read-only at the moment, so nothing can be changed.',
    })
    expect(await ProjectModel.countDocuments({ code: 'NEW' })).toBe(0)
  })

  it('still lets everyone read, and says the site is read-only', async () => {
    const projects = await api({ readOnly: true })
      .get('/api/v1/projects')
      .set('X-Test-User', adminId)
    expect(projects.status).toBe(200)

    const me = await api({ readOnly: true }).get('/api/v1/me')
    expect(me.body).toEqual({ user: null, readOnly: true, publicRead: true })
  })

  it('still lets people sign out', async () => {
    // (Signing out isn't served in these tests, so it's "not found", but not refused)
    const response = await api({ readOnly: true }).post('/api/v1/auth/logout')
    expect(response.status).not.toBe(423)
  })

  it('is off unless it is turned on', async () => {
    const response = await api()
      .post('/api/v1/projects')
      .set('X-Test-User', adminId)
      .send({ code: 'NEW', title: 'A new project' })

    expect(response.status).toBe(201)
  })
})
