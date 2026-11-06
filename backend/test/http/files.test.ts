import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createEntry, createVersion, saveDraft } from '../../src/data/entries.ts'
import { sha256Of, storeFile } from '../../src/data/files.ts'
import { FileModel } from '../../src/data/models/file.ts'
import { NotebookModel } from '../../src/data/models/notebook.ts'
import { ProjectModel } from '../../src/data/models/project.ts'
import { UserModel } from '../../src/data/models/user.ts'
import { fileKey, memoryStore } from '../../src/files/store.ts'
import { startDatabase, stopDatabase } from '../database.ts'
import { api } from './api.ts'

// Images in entries: one in a public project's entry, one in a private project's entry, and
// one shown only by an earlier version of an entry

const store = memoryStore()
const ids = { member: '', outsider: '' }
const files = { open: '', closed: '', old: '' }

function image(name: string) {
  return new TextEncoder().encode(`not really a PNG: ${name}`) as Uint8Array<ArrayBuffer>
}

function showing(fileId: string) {
  return { type: 'doc', content: [{ type: 'fileBlock', attrs: { fileId, alt: 'A gel' } }] }
}

beforeAll(async () => {
  await startDatabase()
  const [member, outsider] = await UserModel.create([
    { orcid: '0000-0002-1825-0097', name: 'Member' },
    { orcid: '0000-0002-1694-233X', name: 'Outsider' },
  ])
  ids.member = member!._id.toHexString()
  ids.outsider = outsider!._id.toHexString()
  const [open, closed] = await ProjectModel.create([
    { code: 'OPEN', title: 'Open', publicRead: true, members: [] },
    { code: 'LAB', title: 'Lab', members: [{ userId: member!._id, role: 'contributor' }] },
  ])
  const [openBook, labBook] = await NotebookModel.create([
    { projectId: open!._id, ownerId: member!._id, title: 'Open book' },
    { projectId: closed!._id, ownerId: member!._id, title: 'Lab book' },
  ])

  const keep = (name: string) =>
    storeFile({ store, body: image(name), contentType: 'image/png', name, userId: member!._id })
  files.open = await keep('open.png')
  files.closed = await keep('closed.png')
  files.old = await keep('old.png')

  await createEntry({
    notebookId: openBook!._id,
    authorId: member!._id,
    kind: 'experiment',
    title: 'Open gel',
    content: showing(files.open),
  })
  await createEntry({
    notebookId: labBook!._id,
    authorId: member!._id,
    kind: 'experiment',
    title: 'Lab gel',
    content: showing(files.closed),
  })
  // Version 1 shows the old image; the draft has since dropped it
  const changed = await createEntry({
    notebookId: openBook!._id,
    authorId: member!._id,
    kind: 'experiment',
    title: 'Changed gel',
    content: showing(files.old),
  })
  await createVersion({ entryId: changed._id, userId: member!._id })
  await saveDraft({
    entryId: changed._id,
    userId: member!._id,
    basedOn: changed.updatedAt,
    title: 'Changed gel',
    content: { type: 'doc', content: [] },
  })
})
afterAll(stopDatabase)

describe('storeFile', () => {
  it('keeps a file once, by its SHA-256, however often it is added', async () => {
    const again = await storeFile({
      store,
      body: image('open.png'),
      contentType: 'image/png',
      name: 'copy.png',
      userId: ids.member,
    })

    expect(again).toBe(files.open)
    expect(files.open).toBe(sha256Of(image('open.png')))
    expect(await store.has(fileKey(files.open))).toBe(true)
    expect(await FileModel.countDocuments({ sha256: files.open })).toBe(1)
  })
})

describe('GET /api/v1/files/:sha256', () => {
  it('serves an image in a public project to anyone', async () => {
    const response = await api({ files: store }).get(`/api/v1/files/${files.open}`)

    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toBe('image/png')
    expect(response.headers['cache-control']).toBe('private, max-age=3600')
    expect(Buffer.from(response.body).toString()).toBe('not really a PNG: open.png')
  })

  it('serves an image in a private project only to its members', async () => {
    const member = await api({ files: store })
      .get(`/api/v1/files/${files.closed}`)
      .set('X-Test-User', ids.member)
    const outsider = await api({ files: store })
      .get(`/api/v1/files/${files.closed}`)
      .set('X-Test-User', ids.outsider)
    const anonymous = await api({ files: store }).get(`/api/v1/files/${files.closed}`)

    expect(member.status).toBe(200)
    expect(outsider.status).toBe(404)
    expect(anonymous.status).toBe(404)
  })

  it('serves an image that only an earlier version shows', async () => {
    const response = await api({ files: store }).get(`/api/v1/files/${files.old}`)

    expect(response.status).toBe(200)
  })

  it('says "not found" for an unknown file, an invalid id, or a site with no file store', async () => {
    const unknown = await api({ files: store }).get(`/api/v1/files/${'0'.repeat(64)}`)
    const invalid = await api({ files: store }).get('/api/v1/files/../../etc/passwd')
    const noStore = await api({ files: null }).get(`/api/v1/files/${files.open}`)

    expect(unknown.status).toBe(404)
    expect(invalid.status).toBe(404)
    expect(noStore.status).toBe(404)
  })

  it('lists the files an entry shows, for its draft and versions', async () => {
    const { EntryModel } = await import('../../src/data/models/entry.ts')
    const entry = await EntryModel.findOne({ title: 'Open gel' }).orFail().lean()

    expect(entry.files).toEqual([files.open])
  })
})
