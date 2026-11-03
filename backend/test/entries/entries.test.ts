import mongoose from 'mongoose'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { createEntry, createVersion, saveDraft, verifyVersions } from '../../src/data/entries.ts'
import { EntryChangeModel } from '../../src/data/models/entry-change.ts'
import { EntryVersionModel } from '../../src/data/models/entry-version.ts'
import { EntryModel } from '../../src/data/models/entry.ts'
import { ConflictError, ForbiddenError, InvalidError } from '../../src/errors.ts'
import { applyJsonPatch } from '../../src/integrity/json-patch.ts'
import { clearDatabase, startDatabase, stopDatabase } from '../database.ts'

beforeAll(startDatabase)
afterEach(clearDatabase)
afterAll(stopDatabase)

const notebookId = new mongoose.Types.ObjectId()
const author = new mongoose.Types.ObjectId()
const someoneElse = new mongoose.Types.ObjectId()

function paragraph(text: string) {
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }
}

async function newEntry() {
  return createEntry({ notebookId, authorId: author, kind: 'experiment', title: 'Western blot' })
}

async function save(entryId: mongoose.Types.ObjectId, title: string, text: string) {
  const current = await EntryModel.findById(entryId).orFail()
  return saveDraft({
    entryId,
    userId: author,
    basedOn: current.updatedAt,
    title,
    content: paragraph(text),
  })
}

describe('createEntry', () => {
  it('creates an empty draft with the next entry code', async () => {
    const first = await newEntry()
    const second = await newEntry()

    expect(first.code).toMatch(/^ELN-\d{4}-0001$/)
    expect(second.code).toMatch(/^ELN-\d{4}-0002$/)
    expect(first.status).toBe('draft')
  })

  it('refuses content that is not in the content format', async () => {
    await expect(
      createEntry({
        notebookId,
        authorId: author,
        kind: 'note',
        title: 'T',
        content: { type: 'x' },
      }),
    ).rejects.toThrow(InvalidError)
  })
})

describe('saveDraft', () => {
  it('saves the draft, keeps a plain-text copy, and records exactly what changed', async () => {
    const entry = await newEntry()

    const { changed } = await save(entry._id, 'Western blot (repeat)', 'Lysates were run.')

    const saved = await EntryModel.findById(entry._id).orFail()
    expect(changed).toBe(true)
    expect(saved.title).toBe('Western blot (repeat)')
    expect(saved.text).toBe('Lysates were run.')

    const [change] = await EntryChangeModel.find({ entryId: entry._id }).lean()
    const before = { title: 'Western blot', content: { type: 'doc', content: [] } }
    expect(change?.userId.toHexString()).toBe(author.toHexString())
    expect(applyJsonPatch(before, change?.diff as never)).toEqual({
      title: 'Western blot (repeat)',
      content: paragraph('Lysates were run.'),
    })
  })

  it('records nothing when nothing changed', async () => {
    const entry = await newEntry()

    const { changed } = await saveDraft({
      entryId: entry._id,
      userId: author,
      basedOn: entry.updatedAt,
      title: 'Western blot',
      content: { type: 'doc', content: [] },
    })

    expect(changed).toBe(false)
    expect(await EntryChangeModel.countDocuments()).toBe(0)
  })

  it('refuses a save based on an out-of-date draft, rather than overwriting', async () => {
    const entry = await newEntry()
    await save(entry._id, 'Saved by a co-author', 'First')

    await expect(
      saveDraft({
        entryId: entry._id,
        userId: author,
        basedOn: entry.updatedAt,
        title: 'Saved without seeing that',
        content: paragraph('Second'),
      }),
    ).rejects.toThrow(ConflictError)
  })

  it('lets only the author and co-authors save', async () => {
    const entry = await newEntry()

    await expect(
      saveDraft({
        entryId: entry._id,
        userId: someoneElse,
        basedOn: entry.updatedAt,
        title: 'T',
        content: paragraph('x'),
      }),
    ).rejects.toThrow(ForbiddenError)
  })

  it('refuses changes to a signed entry', async () => {
    const entry = await newEntry()
    await EntryModel.updateOne({ _id: entry._id }, { status: 'signed' })

    await expect(save(entry._id, 'T', 'x')).rejects.toThrow(/signed/)
  })

  it('refuses invalid content without saving anything', async () => {
    const entry = await newEntry()

    await expect(
      saveDraft({
        entryId: entry._id,
        userId: author,
        basedOn: entry.updatedAt,
        title: 'T',
        content: { type: 'doc', content: [{ type: 'heading', attrs: { level: 9 } }] },
      }),
    ).rejects.toThrow(InvalidError)
    expect(await EntryChangeModel.countDocuments()).toBe(0)
  })
})

describe('createVersion', () => {
  it('makes numbered snapshots with plain-text and Markdown copies, chained by hash', async () => {
    const entry = await newEntry()
    await save(entry._id, 'Western blot', 'Lysates were *run*.')

    const first = await createVersion({ entryId: entry._id, userId: author, note: 'First draft' })
    await save(entry._id, 'Western blot', 'Lysates were run twice.')
    const second = await createVersion({ entryId: entry._id, userId: author })

    expect(first?.number).toBe(1)
    expect(first?.previousHash).toBeNull()
    expect(first?.text).toBe('Lysates were *run*.')
    expect(first?.markdown).toBe('Lysates were \\*run\\*.')
    expect(first?.note).toBe('First draft')
    expect(second?.number).toBe(2)
    expect(second?.previousHash).toBe(first?.hash)

    const updated = await EntryModel.findById(entry._id).orFail()
    expect(updated.latestVersion).toBe(2)
    expect(await verifyVersions(entry._id)).toEqual([])
  })

  it('lets only the author and co-authors create versions', async () => {
    const entry = await newEntry()

    await expect(createVersion({ entryId: entry._id, userId: someoneElse })).rejects.toThrow(
      ForbiddenError,
    )
  })
})

describe('verifyVersions', () => {
  it('detects a version changed directly in the database, bypassing the app', async () => {
    const entry = await newEntry()
    await createVersion({ entryId: entry._id, userId: author })
    await createVersion({ entryId: entry._id, userId: author })

    // Go around Mongoose (and its write-once rule), as someone with database access could
    await EntryVersionModel.collection.updateOne(
      { entryId: entry._id, number: 1 },
      { $set: { title: 'Quietly changed' } },
    )

    expect(await verifyVersions(entry._id)).toEqual([
      'Version 1 has been changed since it was created',
    ])
  })

  it('detects a missing version and a broken chain', async () => {
    const entry = await newEntry()
    await createVersion({ entryId: entry._id, userId: author })
    await createVersion({ entryId: entry._id, userId: author })
    await EntryVersionModel.collection.deleteOne({ entryId: entry._id, number: 1 })

    expect(await verifyVersions(entry._id)).toEqual([
      'Version 1 is missing',
      'Version 2 is not chained to the version before it',
    ])
  })
})
