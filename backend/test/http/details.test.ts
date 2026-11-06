import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { NotebookModel } from '../../src/data/models/notebook.ts'
import { ProjectModel } from '../../src/data/models/project.ts'
import { RecordChangeModel } from '../../src/data/models/record-change.ts'
import { UserModel } from '../../src/data/models/user.ts'
import { startDatabase, stopDatabase } from '../database.ts'
import { api } from './api.ts'

// A private lab with an admin, a contributor who owns a notebook, another contributor, a
// viewer, an outsider and a site admin
const ids = { admin: '', owner: '', colleague: '', viewer: '', outsider: '', siteAdmin: '' }
let projectId = ''
let notebookId = ''

beforeAll(async () => {
  await startDatabase()
  const people = await UserModel.create([
    { orcid: '0000-0002-1825-0097', name: 'Admin' },
    { orcid: '0000-0002-1694-233X', name: 'Owner' },
    { orcid: '0000-0001-5109-3700', name: 'Colleague' },
    { orcid: '0000-0003-1415-9269', name: 'Viewer' },
    { orcid: '0000-0001-5000-0007', name: 'Outsider' },
    { orcid: '0000-0002-9079-593X', name: 'Site admin', siteAdmin: true },
  ])
  const [admin, owner, colleague, viewer, outsider, siteAdmin] = people.map((p) => p._id)
  Object.assign(ids, {
    admin: admin!.toHexString(),
    owner: owner!.toHexString(),
    colleague: colleague!.toHexString(),
    viewer: viewer!.toHexString(),
    outsider: outsider!.toHexString(),
    siteAdmin: siteAdmin!.toHexString(),
  })
  const lab = await ProjectModel.create({
    code: 'LAB',
    title: 'Private lab',
    description: 'Cell signalling',
    members: [
      { userId: admin!, role: 'admin' },
      { userId: owner!, role: 'contributor' },
      { userId: colleague!, role: 'contributor' },
      { userId: viewer!, role: 'viewer' },
    ],
  })
  projectId = lab._id.toHexString()
  const notebook = await NotebookModel.create({
    projectId: lab._id,
    ownerId: owner!,
    title: 'Western blots',
  })
  notebookId = notebook._id.toHexString()
})
afterAll(stopDatabase)

function changesOf(kind: 'project' | 'notebook', recordId: string) {
  return RecordChangeModel.find({ kind, recordId }).sort({ savedAt: 1 }).lean()
}

describe('PATCH /api/v1/projects/:code', () => {
  it('lets a project admin change its details, recording who changed what', async () => {
    const response = await api()
      .patch('/api/v1/projects/LAB')
      .set('X-Test-User', ids.admin)
      .send({ title: 'Signalling lab', publicRead: true })

    expect(response.status).toBe(200)
    expect(response.body.changed).toBe(true)
    expect(response.body.project).toMatchObject({
      code: 'LAB',
      title: 'Signalling lab',
      description: 'Cell signalling',
      publicRead: true,
      yourRole: 'admin',
    })
    const changes = await changesOf('project', projectId)
    expect(changes.at(-1)!.userId.toHexString()).toBe(ids.admin)
    expect(changes.at(-1)!.diff).toEqual([
      { op: 'replace', path: '/title', value: 'Signalling lab' },
      { op: 'replace', path: '/publicRead', value: true },
    ])
  })

  it('changes its credit: source, licence and citation', async () => {
    const response = await api().patch('/api/v1/projects/LAB').set('X-Test-User', ids.admin).send({
      sourceRepository: 'https://zenodo.org/records/1',
      licence: 'CC BY 4.0',
      citation: 'Lab (2026). https://doi.org/10.5281/zenodo.1',
    })

    expect(response.body.project).toMatchObject({
      sourceRepository: 'https://zenodo.org/records/1',
      licence: 'CC BY 4.0',
      citation: 'Lab (2026). https://doi.org/10.5281/zenodo.1',
    })
    const changes = await changesOf('project', projectId)
    expect(changes.at(-1)!.diff.map((operation) => operation.path)).toEqual([
      '/sourceRepository',
      '/licence',
      '/citation',
    ])
  })

  it('records nothing when nothing changes', async () => {
    const before = (await changesOf('project', projectId)).length
    const response = await api()
      .patch('/api/v1/projects/LAB')
      .set('X-Test-User', ids.siteAdmin)
      .send({ description: 'Cell signalling' })

    expect(response.status).toBe(200)
    expect(response.body.changed).toBe(false)
    expect(await changesOf('project', projectId)).toHaveLength(before)
  })

  it('never changes the code', async () => {
    const response = await api()
      .patch('/api/v1/projects/LAB')
      .set('X-Test-User', ids.admin)
      .send({ code: 'NEW' })

    expect(response.body.project.code).toBe('LAB')
  })

  it('refuses an empty title or a public setting that is not true or false', async () => {
    const response = await api()
      .patch('/api/v1/projects/LAB')
      .set('X-Test-User', ids.admin)
      .send({ title: ' ', publicRead: 'yes' })

    expect(response.status).toBe(422)
    expect(response.body.problems).toEqual([
      { path: 'title', message: 'should be text that is not empty' },
      { path: 'publicRead', message: 'should be true or false' },
    ])
  })

  it('lets only admins and site admins change it', async () => {
    const contributor = await api()
      .patch('/api/v1/projects/LAB')
      .set('X-Test-User', ids.owner)
      .send({ title: 'Mine now' })
    const anonymous = await api().patch('/api/v1/projects/LAB').send({ title: 'Mine now' })

    expect(contributor.status).toBe(403)
    expect(anonymous.status).toBe(401)
  })

  it('is refused while the site is read-only', async () => {
    const response = await api({ readOnly: true })
      .patch('/api/v1/projects/LAB')
      .set('X-Test-User', ids.admin)
      .send({ title: 'Locked' })

    expect(response.status).toBe(423)
  })
})

describe('PATCH /api/v1/notebooks/:id', () => {
  // The project tests above made the project public; these need it private again
  beforeAll(async () => {
    await ProjectModel.updateOne({ code: 'LAB' }, { publicRead: false })
  })

  it('lets the owner change its title and description, recording the change', async () => {
    const response = await api()
      .patch(`/api/v1/notebooks/${notebookId}`)
      .set('X-Test-User', ids.owner)
      .send({ title: 'Westerns', description: 'Blots for the p53 study' })

    expect(response.status).toBe(200)
    expect(response.body.notebook).toMatchObject({
      id: notebookId,
      title: 'Westerns',
      description: 'Blots for the p53 study',
      owner: { name: 'Owner', orcid: '0000-0002-1694-233X' },
      canEdit: true,
    })
    const changes = await changesOf('notebook', notebookId)
    expect(changes).toHaveLength(1)
    expect(changes[0]!.userId.toHexString()).toBe(ids.owner)
  })

  it.each([
    ['the project’s admin', 'admin', 200],
    ['a site admin', 'siteAdmin', 200],
    ['another contributor', 'colleague', 403],
    ['a viewer', 'viewer', 403],
    ['an outsider', 'outsider', 404],
  ] as const)('lets %s change it, or not', async (_who, as, status) => {
    const response = await api()
      .patch(`/api/v1/notebooks/${notebookId}`)
      .set('X-Test-User', ids[as])
      .send({ description: `Changed by ${as}` })

    expect(response.status).toBe(status)
  })

  it('tells the notebook page who can change it', async () => {
    const owner = await api().get(`/api/v1/notebooks/${notebookId}`).set('X-Test-User', ids.owner)
    const colleague = await api()
      .get(`/api/v1/notebooks/${notebookId}`)
      .set('X-Test-User', ids.colleague)

    expect(owner.body.notebook.canEdit).toBe(true)
    expect(colleague.body.notebook.canEdit).toBe(false)
  })
})
