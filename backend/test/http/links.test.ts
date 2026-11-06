import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { NotebookModel } from '../../src/data/models/notebook.ts'
import { ProjectModel } from '../../src/data/models/project.ts'
import { UserModel } from '../../src/data/models/user.ts'
import { startDatabase, stopDatabase } from '../database.ts'
import { api } from './api.ts'

// Links between entries: an author in two projects, and a viewer of only one of them
const ids = { author: '', viewer: '' }
const notebooks = { lab: '', other: '' }

function linkTo(code: string) {
  return {
    type: 'recordLink',
    attrs: {
      system: 'protoeln',
      kind: 'entry',
      url: `/entries/${code}`,
      label: code,
      externalId: code,
    },
  }
}

async function newEntry(notebook: string, title: string, content: unknown[] = []) {
  const response = await api()
    .post(`/api/v1/notebooks/${notebook}/entries`)
    .set('X-Test-User', ids.author)
    .send({ kind: 'note', title, content: { type: 'doc', content } })
  expect(response.status).toBe(201)
  return response.body as { code: string; updatedAt: string }
}

function linkedFrom(code: string, user = ids.viewer) {
  return api().get(`/api/v1/entries/${code}/linked-from`).set('X-Test-User', user)
}

beforeAll(async () => {
  await startDatabase()
  const [author, viewer] = await UserModel.create([
    { orcid: '0000-0002-1825-0097', name: 'Author' },
    { orcid: '0000-0001-5109-3700', name: 'Viewer' },
  ])
  ids.author = author!._id.toHexString()
  ids.viewer = viewer!._id.toHexString()

  const [lab, other] = await ProjectModel.create([
    {
      code: 'LAB',
      title: 'Private lab',
      members: [
        { userId: author!._id, role: 'contributor' },
        { userId: viewer!._id, role: 'viewer' },
      ],
    },
    {
      code: 'OTHER',
      title: 'Another lab',
      members: [{ userId: author!._id, role: 'contributor' }],
    },
  ])
  const [labNotebook, otherNotebook] = await NotebookModel.create([
    { projectId: lab!._id, ownerId: author!._id, title: 'Western blots' },
    { projectId: other!._id, ownerId: author!._id, title: 'Elsewhere' },
  ])
  notebooks.lab = labNotebook!._id.toHexString()
  notebooks.other = otherNotebook!._id.toHexString()
})
afterAll(stopDatabase)

describe('GET /api/v1/entries/:code/linked-from', () => {
  it('lists the entries that link to an entry, but only those the requester can read', async () => {
    const target = await newEntry(notebooks.lab, 'Lysate prep')
    const linking = await newEntry(notebooks.lab, 'Blot 1', [
      { type: 'blockquote', content: [linkTo(target.code)] },
    ])
    await newEntry(notebooks.other, 'Elsewhere', [linkTo(target.code)])
    await newEntry(notebooks.lab, 'Unrelated')

    const response = await linkedFrom(target.code)

    expect(response.status).toBe(200)
    expect(response.body).toEqual([
      expect.objectContaining({
        code: linking.code,
        title: 'Blot 1',
        linkedIn: { draft: true, versions: [] },
        notebook: expect.objectContaining({ title: 'Western blots' }),
        project: expect.objectContaining({ code: 'LAB' }),
      }),
    ])
    // The author, who can read both projects, sees both
    expect((await linkedFrom(target.code, ids.author)).body).toHaveLength(2)
  })

  it('follows the draft as it changes', async () => {
    const target = await newEntry(notebooks.lab, 'Buffer recipe')
    const linking = await newEntry(notebooks.lab, 'Blot 2', [linkTo(target.code)])
    expect((await linkedFrom(target.code)).body).toHaveLength(1)

    const saved = await api()
      .put(`/api/v1/entries/${linking.code}/draft`)
      .set('X-Test-User', ids.author)
      .send({ basedOn: linking.updatedAt, title: 'Blot 2', content: { type: 'doc', content: [] } })
    expect(saved.status).toBe(200)

    expect((await linkedFrom(target.code)).body).toEqual([])
  })

  it('keeps listing an entry whose version links here, after its draft stops linking', async () => {
    const target = await newEntry(notebooks.lab, 'Gel recipe')
    const linking = await newEntry(notebooks.lab, 'Blot 3', [linkTo(target.code)])
    const version = await api()
      .post(`/api/v1/entries/${linking.code}/versions`)
      .set('X-Test-User', ids.author)
      .send({})
    expect(version.status).toBe(201)

    // Creating a version doesn't change the draft, so a save based on it still goes through
    const saved = await api()
      .put(`/api/v1/entries/${linking.code}/draft`)
      .set('X-Test-User', ids.author)
      .send({ basedOn: linking.updatedAt, title: 'Blot 3', content: { type: 'doc', content: [] } })
    expect(saved.status).toBe(200)

    expect((await linkedFrom(target.code)).body).toEqual([
      expect.objectContaining({ code: linking.code, linkedIn: { draft: false, versions: [1] } }),
    ])
  })

  it('says when there is no such entry', async () => {
    expect((await linkedFrom('ELN-2026-9999')).status).toBe(404)
  })
})
