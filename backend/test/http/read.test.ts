import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createEntry } from '../../src/data/entries.ts'
import { NotebookModel } from '../../src/data/models/notebook.ts'
import { ProjectModel } from '../../src/data/models/project.ts'
import { UserModel } from '../../src/data/models/user.ts'
import { startDatabase, stopDatabase } from '../database.ts'
import { api } from './api.ts'

// One small lab, set up once: a public project and a private one, with a member, a viewer,
// an outsider and a site admin
const ids = { member: '', viewer: '', outsider: '', admin: '' }
let privateNotebookId = ''
let privateEntryCode = ''

beforeAll(async () => {
  await startDatabase()
  const [member, viewer, outsider, admin] = await UserModel.create([
    { orcid: '0000-0002-1825-0097', name: 'Member' },
    { orcid: '0000-0002-1694-233X', name: 'Viewer' },
    { orcid: '0000-0001-5109-3700', name: 'Outsider' },
    { orcid: '0000-0003-1415-9269', name: 'Admin', siteAdmin: true },
  ])
  ids.member = member!._id.toHexString()
  ids.viewer = viewer!._id.toHexString()
  ids.outsider = outsider!._id.toHexString()
  ids.admin = admin!._id.toHexString()

  await ProjectModel.create({ code: 'PUB', title: 'Public demo', publicRead: true })
  const lab = await ProjectModel.create({
    code: 'LAB',
    title: 'Private lab',
    members: [
      { userId: member!._id, role: 'contributor' },
      { userId: viewer!._id, role: 'viewer' },
    ],
  })
  const notebook = await NotebookModel.create({
    projectId: lab._id,
    ownerId: member!._id,
    title: 'Western blots',
  })
  privateNotebookId = notebook._id.toHexString()
  const entry = await createEntry({
    notebookId: notebook._id,
    authorId: member!._id,
    kind: 'experiment',
    title: 'p53 after doxorubicin',
  })
  privateEntryCode = entry.code
})
afterAll(stopDatabase)

describe('GET /api/v1/me', () => {
  it('says no one is signed in for an anonymous request', async () => {
    const response = await api().get('/api/v1/me')

    expect(response.body).toEqual({ user: null, readOnly: false })
  })

  it('names the signed-in user', async () => {
    const response = await api().get('/api/v1/me').set('X-Test-User', ids.member)

    expect(response.body.user).toEqual({
      name: 'Member',
      orcid: '0000-0002-1825-0097',
      orcidUrl: 'https://orcid.org/0000-0002-1825-0097',
      siteAdmin: false,
      since: expect.any(String),
      roles: [{ project: { code: 'LAB', title: 'Private lab' }, role: 'contributor' }],
    })
  })
})

describe('GET /api/v1/projects', () => {
  it.each([
    ['anyone', undefined, ['PUB']],
    ['a contributor', 'member', ['LAB', 'PUB']],
    ['a viewer', 'viewer', ['LAB', 'PUB']],
    ['an outsider', 'outsider', ['PUB']],
    ['a site admin', 'admin', ['LAB', 'PUB']],
  ] as const)('lists the projects %s can read', async (_who, as, codes) => {
    const call = api().get('/api/v1/projects')
    const response = await (as ? call.set('X-Test-User', ids[as]) : call)

    expect(response.status).toBe(200)
    expect(response.body.map((project: { code: string }) => project.code)).toEqual(codes)
  })

  it('shows no internal details, such as members’ database ids', async () => {
    const response = await api().get('/api/v1/projects')

    expect(Object.keys(response.body[0]).sort()).toEqual([
      'canContribute',
      'canManageMembers',
      'code',
      'createdAt',
      'description',
      'links',
      'publicRead',
      'title',
      'updatedAt',
      'yourRole',
    ])
  })

  it('tells each person their role in each project', async () => {
    const response = await api().get('/api/v1/projects').set('X-Test-User', ids.viewer)

    expect(response.body.map((project: { yourRole: string }) => project.yourRole)).toEqual([
      'viewer',
      null,
    ])
  })
})

describe('GET /api/v1/projects/:code', () => {
  it('shows a project and its notebooks to someone who can read it', async () => {
    const response = await api().get('/api/v1/projects/LAB').set('X-Test-User', ids.viewer)

    expect(response.status).toBe(200)
    expect(response.body.project.title).toBe('Private lab')
    expect(response.body.notebooks).toEqual([
      expect.objectContaining({
        id: privateNotebookId,
        title: 'Western blots',
        owner: { name: 'Member', orcid: '0000-0002-1825-0097' },
      }),
    ])
  })

  it('says a private project is not found, rather than forbidden, to others', async () => {
    const anonymous = await api().get('/api/v1/projects/LAB')
    const outsider = await api().get('/api/v1/projects/LAB').set('X-Test-User', ids.outsider)

    expect(anonymous.status).toBe(404)
    expect(outsider.status).toBe(404)
    expect(outsider.body).toEqual({ error: 'Project not found' })
  })
})

describe('GET /api/v1/notebooks/:id', () => {
  it('shows a notebook with a summary of its entries', async () => {
    const response = await api()
      .get(`/api/v1/notebooks/${privateNotebookId}`)
      .set('X-Test-User', ids.member)

    expect(response.status).toBe(200)
    expect(response.body.project.code).toBe('LAB')
    expect(response.body.entries).toHaveLength(1)
    expect(response.body.entries[0].code).toBe(privateEntryCode)
    expect(response.body.entries[0].author).toEqual({
      name: 'Member',
      orcid: '0000-0002-1825-0097',
    })
    expect(response.body.entries[0].content).toBeUndefined()
  })

  it('is not found for an outsider, or for an id that is not valid', async () => {
    const outsider = await api()
      .get(`/api/v1/notebooks/${privateNotebookId}`)
      .set('X-Test-User', ids.outsider)
    const invalid = await api().get('/api/v1/notebooks/not-an-id').set('X-Test-User', ids.admin)

    expect(outsider.status).toBe(404)
    expect(invalid.status).toBe(404)
  })
})

describe('GET /api/v1/notebooks and /api/v1/entries', () => {
  it('list every notebook and entry the requester can read, with where each is', async () => {
    const notebooks = await api().get('/api/v1/notebooks').set('X-Test-User', ids.viewer)
    const entries = await api().get('/api/v1/entries').set('X-Test-User', ids.viewer)

    expect(notebooks.body).toEqual([
      expect.objectContaining({
        id: privateNotebookId,
        title: 'Western blots',
        project: { code: 'LAB', title: 'Private lab' },
      }),
    ])
    expect(entries.body).toEqual([
      expect.objectContaining({
        code: privateEntryCode,
        author: { name: 'Member', orcid: '0000-0002-1825-0097' },
        notebook: { id: privateNotebookId, title: 'Western blots' },
        project: { code: 'LAB', title: 'Private lab' },
      }),
    ])
    expect(entries.body[0]).not.toHaveProperty('content')
  })

  it('leave out notebooks and entries in projects the requester cannot read', async () => {
    const notebooks = await api().get('/api/v1/notebooks').set('X-Test-User', ids.outsider)
    const entries = await api().get('/api/v1/entries')

    expect(notebooks.body).toEqual([])
    expect(entries.body).toEqual([])
  })
})

describe('GET /api/v1/entries/:code', () => {
  it('shows an entry, with its notebook and project', async () => {
    const response = await api()
      .get(`/api/v1/entries/${privateEntryCode}`)
      .set('X-Test-User', ids.admin)

    expect(response.status).toBe(200)
    expect(response.body.entry.content).toEqual({ type: 'doc', content: [] })
    expect(response.body.entry.author.name).toBe('Member')
    expect(response.body.entry.coAuthors).toEqual([])
    expect(response.body.entry).not.toHaveProperty('_id')
    expect(response.body.entry).not.toHaveProperty('authorId')
    expect(response.body.notebook).toEqual({ id: privateNotebookId, title: 'Western blots' })
    expect(response.body.project).toEqual({ code: 'LAB', title: 'Private lab' })
  })

  it('says whether the requester can edit it: its author can, others cannot', async () => {
    const author = await api()
      .get(`/api/v1/entries/${privateEntryCode}`)
      .set('X-Test-User', ids.member)
    const siteAdmin = await api()
      .get(`/api/v1/entries/${privateEntryCode}`)
      .set('X-Test-User', ids.admin)

    expect(author.body.entry.canEdit).toBe(true)
    expect(siteAdmin.body.entry.canEdit).toBe(false)
  })

  it('is not found for someone who cannot read its project', async () => {
    const response = await api().get(`/api/v1/entries/${privateEntryCode}`)

    expect(response.status).toBe(404)
  })
})

describe('errors', () => {
  it('answers an unknown address with a JSON "not found"', async () => {
    const response = await api().get('/api/v1/nothing-here')

    expect(response.status).toBe(404)
    expect(response.body).toEqual({ error: 'Not found' })
  })

  it('answers a request body that is not valid JSON with a 400', async () => {
    const response = await api()
      .post('/api/v1/projects')
      .set('Content-Type', 'application/json')
      .send('{ not json')

    expect(response.status).toBe(400)
    expect(response.body).toEqual({ error: 'The request body is not valid JSON' })
  })
})
