import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { EntryChangeModel } from '../../src/data/models/entry-change.ts'
import { EntryModel } from '../../src/data/models/entry.ts'
import { NotebookModel } from '../../src/data/models/notebook.ts'
import { ProjectModel } from '../../src/data/models/project.ts'
import { UserModel } from '../../src/data/models/user.ts'
import { startDatabase, stopDatabase } from '../database.ts'
import { api } from './api.ts'

// Ticking off protocol steps: a lab with an author, a colleague and a viewer
const ids = { author: '', colleague: '', viewer: '' }
const AUTHOR_ORCID = '0000-0002-1825-0097'
let notebookId = ''

function step(text: string, attrs: Record<string, unknown> = { done: false }) {
  return { type: 'protocolStep', attrs, content: [{ type: 'text', text }] }
}

const method = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Method' }] },
    step('Thaw the lysates'),
    step('Spin them down'),
  ],
}

beforeAll(async () => {
  await startDatabase()
  const [author, colleague, viewer] = await UserModel.create([
    { orcid: AUTHOR_ORCID, name: 'Author' },
    { orcid: '0000-0002-1694-233X', name: 'Colleague' },
    { orcid: '0000-0001-5109-3700', name: 'Viewer' },
  ])
  ids.author = author!._id.toHexString()
  ids.colleague = colleague!._id.toHexString()
  ids.viewer = viewer!._id.toHexString()

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

// A fresh protocol by the author for each test
let entryCode = ''
let savedAt = ''
beforeEach(async () => {
  const response = await api()
    .post(`/api/v1/notebooks/${notebookId}/entries`)
    .set('X-Test-User', ids.author)
    .send({ kind: 'protocol', title: 'Lysate prep', content: method })
  entryCode = response.body.code
  savedAt = response.body.updatedAt
})

function tick(body: Record<string, unknown>, user = ids.author) {
  return api().put(`/api/v1/entries/${entryCode}/steps`).set('X-Test-User', user).send(body)
}

describe('PUT /api/v1/entries/:code/steps', () => {
  it('ticks a step, recording who ticked it and when from the server', async () => {
    const before = Date.now()
    const response = await tick({ basedOn: savedAt, path: [1], done: true })

    expect(response.status).toBe(200)
    expect(response.body.changed).toBe(true)
    const { attrs } = response.body.entry.content.content[1]
    expect(attrs).toEqual({ done: true, doneBy: AUTHOR_ORCID, doneAt: expect.any(String) })
    expect(new Date(attrs.doneAt).getTime()).toBeGreaterThanOrEqual(before)
    expect(response.body.entry.contentPeople).toEqual({ [AUTHOR_ORCID]: 'Author' })
    expect(response.body.entry.content.content[2].attrs).toEqual({ done: false })

    // Like any save, it's kept in the entry's history
    const entry = await EntryModel.findOne({ code: entryCode }).orFail()
    expect(await EntryChangeModel.countDocuments({ entryId: entry._id })).toBe(1)
    const read = await api().get(`/api/v1/entries/${entryCode}`).set('X-Test-User', ids.viewer)
    expect(read.body.entry.contentPeople).toEqual({ [AUTHOR_ORCID]: 'Author' })
  })

  it('unticks a step, and says when nothing changed', async () => {
    const ticked = await tick({ basedOn: savedAt, path: [1], done: true })
    const unticked = await tick({ basedOn: ticked.body.entry.updatedAt, path: [1], done: false })

    expect(unticked.body.changed).toBe(true)
    expect(unticked.body.entry.content.content[1].attrs).toEqual({ done: false })
    expect(unticked.body.entry.contentPeople).toEqual({})
    const again = await tick({ basedOn: unticked.body.entry.updatedAt, path: [1], done: false })
    expect(again.body.changed).toBe(false)
  })

  it('refuses a path that isn’t a step, an out-of-date draft, and anyone but the author', async () => {
    const notStep = await tick({ basedOn: savedAt, path: [0], done: true })
    expect(notStep.status).toBe(422)
    expect(notStep.body.problems).toEqual([
      { path: 'path', message: 'should be where a protocol step is in the draft' },
    ])
    const badBody = await tick({ basedOn: savedAt, path: 'first', done: 'yes' })
    expect(badBody.body.problems.map((problem: { path: string }) => problem.path)).toEqual([
      'path',
      'done',
    ])

    expect((await tick({ basedOn: savedAt, path: [1], done: true })).status).toBe(200)
    const outOfDate = { basedOn: savedAt, path: [2], done: true }
    expect((await tick(outOfDate)).status).toBe(409)
    expect((await tick(outOfDate, ids.colleague)).status).toBe(403)
    expect((await tick(outOfDate, ids.viewer)).status).toBe(403)
  })
})

describe('ticks in saved content', () => {
  it('lets a draft save keep and move ticks, but not add or change them', async () => {
    const ticked = await tick({ basedOn: savedAt, path: [1], done: true })
    const [heading, thaw, spin] = ticked.body.entry.content.content
    const save = (content: unknown[], basedOn: string) =>
      api()
        .put(`/api/v1/entries/${entryCode}/draft`)
        .set('X-Test-User', ids.author)
        .send({ basedOn, title: 'Lysate prep', content: { type: 'doc', content } })

    // The ticked step moved below the other one
    const moved = await save([heading, spin, thaw], ticked.body.entry.updatedAt)
    expect(moved.status).toBe(200)

    const forged = await save(
      [heading, step('Spin them down', { ...thaw.attrs }), thaw],
      moved.body.entry.updatedAt,
    )
    expect(forged.status).toBe(422)
    expect(forged.body.problems).toEqual([
      {
        path: 'content[2].attrs',
        message: 'should be as saved: steps are ticked and unticked on the entry page',
      },
    ])
    const changed = await save(
      [heading, spin, step('Thaw the lysates', { ...thaw.attrs, doneAt: '2020-01-01T00:00:00Z' })],
      moved.body.entry.updatedAt,
    )
    expect(changed.status).toBe(422)
  })

  it('refuses a new entry with steps already ticked', async () => {
    const response = await api()
      .post(`/api/v1/notebooks/${notebookId}/entries`)
      .set('X-Test-User', ids.author)
      .send({
        kind: 'protocol',
        title: 'Ticked already',
        content: { type: 'doc', content: [step('Thaw', { done: true })] },
      })

    expect(response.status).toBe(422)
    expect(response.body.problems[0].path).toBe('content[0].attrs')
  })
})
