import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { EntryModel } from '../../src/data/models/entry.ts'
import { NotebookModel } from '../../src/data/models/notebook.ts'
import { ProjectModel } from '../../src/data/models/project.ts'
import { UserModel } from '../../src/data/models/user.ts'
import { startDatabase, stopDatabase } from '../database.ts'
import { api } from './api.ts'

// A private lab with two members (an author and a colleague), a viewer and an outsider
const ids = { author: '', colleague: '', viewer: '', outsider: '', admin: '' }
let notebookId = ''

function paragraph(text: string) {
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }
}

beforeAll(async () => {
  await startDatabase()
  const [author, colleague, viewer, outsider, admin] = await UserModel.create([
    { orcid: '0000-0002-1825-0097', name: 'Author' },
    { orcid: '0000-0002-1694-233X', name: 'Colleague' },
    { orcid: '0000-0001-5109-3700', name: 'Viewer' },
    { orcid: '0000-0003-1415-9269', name: 'Outsider' },
    { orcid: '0000-0001-5000-0007', name: 'Admin', siteAdmin: true },
  ])
  ids.author = author!._id.toHexString()
  ids.colleague = colleague!._id.toHexString()
  ids.viewer = viewer!._id.toHexString()
  ids.outsider = outsider!._id.toHexString()
  ids.admin = admin!._id.toHexString()

  const lab = await ProjectModel.create({
    code: 'LAB',
    title: 'Private lab',
    members: [
      { userId: author!._id, role: 'contributor' },
      { userId: colleague!._id, role: 'contributor' },
      { userId: viewer!._id, role: 'viewer' },
    ],
  })
  const notebook = await NotebookModel.create({
    projectId: lab._id,
    ownerId: author!._id,
    title: 'Western blots',
  })
  notebookId = notebook._id.toHexString()
})
afterAll(stopDatabase)

// A fresh entry by the author for each test that needs one
let entryCode = ''
let savedAt = ''
beforeEach(async () => {
  const response = await api()
    .post(`/api/v1/notebooks/${notebookId}/entries`)
    .set('X-Test-User', ids.author)
    .send({ kind: 'experiment', title: 'Western blot' })
  entryCode = response.body.code
  savedAt = response.body.updatedAt
})

describe('POST /api/v1/projects', () => {
  it('lets a site admin create a project, of which they become an admin', async () => {
    const response = await api()
      .post('/api/v1/projects')
      .set('X-Test-User', ids.admin)
      .send({ code: 'NEW1', title: 'New project', publicRead: true })

    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({
      code: 'NEW1',
      title: 'New project',
      description: '',
      publicRead: true,
      yourRole: 'admin',
      canContribute: true,
    })
    const project = await ProjectModel.findOne({ code: 'NEW1' }).orFail().lean()
    expect(project.members.map((member) => [String(member.userId), member.role])).toEqual([
      [ids.admin, 'admin'],
    ])
  })

  it.each([
    ['no one is signed in', undefined, 401],
    ['the user is not a site admin', 'author', 403],
  ] as const)('refuses when %s', async (_why, as, status) => {
    const call = api().post('/api/v1/projects').send({ code: 'NEW2', title: 'New' })
    const response = await (as ? call.set('X-Test-User', ids[as]) : call)

    expect(response.status).toBe(status)
  })

  it('refuses a code already in use, or not in the right form', async () => {
    const taken = await api()
      .post('/api/v1/projects')
      .set('X-Test-User', ids.admin)
      .send({ code: 'LAB', title: 'Another lab' })
    const badCode = await api()
      .post('/api/v1/projects')
      .set('X-Test-User', ids.admin)
      .send({ code: 'lab-2', title: 'Another lab' })

    expect(taken.status).toBe(409)
    expect(taken.body.error).toBe('There is already a project with the code LAB')
    expect(badCode.status).toBe(422)
    expect(badCode.body.problems[0].path).toBe('code')
  })
})

describe('POST /api/v1/projects/:code/notebooks', () => {
  it('lets a member create a notebook, which they own', async () => {
    const response = await api()
      .post('/api/v1/projects/LAB/notebooks')
      .set('X-Test-User', ids.colleague)
      .send({ title: 'PCR' })

    expect(response.status).toBe(201)
    expect(response.body.owner).toEqual({ name: 'Colleague', orcid: '0000-0002-1694-233X' })
    expect(response.body.description).toBe('')
  })

  it.each([
    ['no one is signed in', undefined, 401],
    ['the user is a viewer', 'viewer', 403],
    ['the user cannot read the project', 'outsider', 404],
  ] as const)('refuses when %s', async (_why, as, status) => {
    const call = api().post('/api/v1/projects/LAB/notebooks').send({ title: 'PCR' })
    const response = await (as ? call.set('X-Test-User', ids[as]) : call)

    expect(response.status).toBe(status)
  })

  it('says what is wrong with the request', async () => {
    const response = await api()
      .post('/api/v1/projects/LAB/notebooks')
      .set('X-Test-User', ids.author)
      .send({ title: '  ', description: 3 })

    expect(response.status).toBe(422)
    expect(response.body.problems.map((problem: { path: string }) => problem.path)).toEqual([
      'title',
      'description',
    ])
  })
})

describe('POST /api/v1/notebooks/:id/entries', () => {
  it('creates a draft entry with the next code, authored by the member', async () => {
    const response = await api()
      .post(`/api/v1/notebooks/${notebookId}/entries`)
      .set('X-Test-User', ids.colleague)
      .send({ kind: 'protocol', title: 'Transfer', content: paragraph('Use wet transfer.') })

    expect(response.status).toBe(201)
    expect(response.body.code).toMatch(/^ELN-\d{4}-\d{4}$/)
    expect(response.body.author).toEqual({ name: 'Colleague', orcid: '0000-0002-1694-233X' })
    expect(response.body.text).toBe('Use wet transfer.')
  })

  it('refuses an unknown kind and content not in the content format', async () => {
    const kind = await api()
      .post(`/api/v1/notebooks/${notebookId}/entries`)
      .set('X-Test-User', ids.author)
      .send({ kind: 'diary', title: 'T' })
    const content = await api()
      .post(`/api/v1/notebooks/${notebookId}/entries`)
      .set('X-Test-User', ids.author)
      .send({ kind: 'note', title: 'T', content: { type: 'doc', content: [{ type: 'video' }] } })

    expect(kind.status).toBe(422)
    expect(kind.body.problems[0].path).toBe('kind')
    expect(content.status).toBe(422)
    expect(content.body.problems[0].path).toBe('content[0].type')
  })

  it('refuses a viewer', async () => {
    const response = await api()
      .post(`/api/v1/notebooks/${notebookId}/entries`)
      .set('X-Test-User', ids.viewer)
      .send({ kind: 'note', title: 'T' })

    expect(response.status).toBe(403)
  })
})

describe('PUT /api/v1/entries/:code/draft', () => {
  it('saves the author’s draft', async () => {
    const response = await api()
      .put(`/api/v1/entries/${entryCode}/draft`)
      .set('X-Test-User', ids.author)
      .send({ basedOn: savedAt, title: 'Western blot', content: paragraph('Lysates were run.') })

    expect(response.status).toBe(200)
    expect(response.body.changed).toBe(true)
    expect(response.body.entry.text).toBe('Lysates were run.')
  })

  it('refuses a save based on an out-of-date draft', async () => {
    const save = (text: string) =>
      api()
        .put(`/api/v1/entries/${entryCode}/draft`)
        .set('X-Test-User', ids.author)
        .send({ basedOn: savedAt, title: 'Western blot', content: paragraph(text) })

    expect((await save('First')).status).toBe(200)
    expect((await save('Second, from an older copy')).status).toBe(409)
  })

  it('lets only the author edit, not other members', async () => {
    const response = await api()
      .put(`/api/v1/entries/${entryCode}/draft`)
      .set('X-Test-User', ids.colleague)
      .send({ basedOn: savedAt, title: 'T', content: paragraph('x') })

    expect(response.status).toBe(403)
  })

  it('refuses changes to a signed entry', async () => {
    await EntryModel.updateOne({ code: entryCode }, { status: 'signed' })

    const response = await api()
      .put(`/api/v1/entries/${entryCode}/draft`)
      .set('X-Test-User', ids.author)
      .send({ basedOn: savedAt, title: 'T', content: paragraph('x') })

    expect(response.status).toBe(409)
  })

  it('needs to know which saved draft the edit was based on', async () => {
    const response = await api()
      .put(`/api/v1/entries/${entryCode}/draft`)
      .set('X-Test-User', ids.author)
      .send({ basedOn: 'yesterday', title: 'T', content: paragraph('x') })

    expect(response.status).toBe(422)
    expect(response.body.problems[0].path).toBe('basedOn')
  })
})

describe('versions', () => {
  it('creates, lists and shows versions, and checks the history', async () => {
    const created = await api()
      .post(`/api/v1/entries/${entryCode}/versions`)
      .set('X-Test-User', ids.author)
      .send({ note: 'First draft' })
    await api()
      .post(`/api/v1/entries/${entryCode}/versions`)
      .set('X-Test-User', ids.author)
      .send({})

    const list = await api()
      .get(`/api/v1/entries/${entryCode}/versions`)
      .set('X-Test-User', ids.viewer)
    const first = await api()
      .get(`/api/v1/entries/${entryCode}/versions/1`)
      .set('X-Test-User', ids.viewer)
    const check = await api()
      .get(`/api/v1/entries/${entryCode}/history-check`)
      .set('X-Test-User', ids.viewer)

    expect(created.status).toBe(201)
    expect(created.body.number).toBe(1)
    expect(list.body.map((version: { number: number }) => version.number)).toEqual([2, 1])
    expect(list.body[0].content).toBeUndefined()
    expect(first.body.note).toBe('First draft')
    expect(first.body.createdBy).toEqual({ name: 'Author', orcid: '0000-0002-1825-0097' })
    expect(first.body.markdown).toBe('')
    expect(first.body.contentPeople).toEqual({})
    expect(check.body).toEqual({ intact: true, problems: [] })
  })

  it('says a version that does not exist is not found', async () => {
    const missing = await api()
      .get(`/api/v1/entries/${entryCode}/versions/9`)
      .set('X-Test-User', ids.author)
    const notANumber = await api()
      .get(`/api/v1/entries/${entryCode}/versions/first`)
      .set('X-Test-User', ids.author)

    expect(missing.status).toBe(404)
    expect(notANumber.status).toBe(404)
  })

  it('lets only the author create versions, and hides versions from outsiders', async () => {
    const colleague = await api()
      .post(`/api/v1/entries/${entryCode}/versions`)
      .set('X-Test-User', ids.colleague)
      .send({})
    const outsider = await api()
      .get(`/api/v1/entries/${entryCode}/versions`)
      .set('X-Test-User', ids.outsider)

    expect(colleague.status).toBe(403)
    expect(outsider.status).toBe(404)
  })
})
