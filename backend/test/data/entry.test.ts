import mongoose from 'mongoose'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { CONTENT_FORMAT, EntryModel } from '../../src/data/models/entry.ts'
import { clearDatabase, startDatabase, stopDatabase, validationErrors } from '../database.ts'

beforeAll(startDatabase)
afterEach(clearDatabase)
afterAll(stopDatabase)

const notebookId = new mongoose.Types.ObjectId()
const authorId = new mongoose.Types.ObjectId()

// The fields every entry needs ('as const' keeps kind as the exact value, not any string)
const validEntry = {
  code: 'ELN-2026-0001',
  notebookId,
  authorId,
  kind: 'experiment',
  title: 'Western blot: p53 after doxorubicin',
} as const

describe('EntryModel', () => {
  it('saves a new entry as an empty draft', async () => {
    const entry = await EntryModel.create(validEntry)

    expect(entry.status).toBe('draft')
    expect(entry.contentFormat).toBe(CONTENT_FORMAT)
    expect(entry.content).toEqual({ type: 'doc', content: [] })
    expect(entry.text).toBe('')
    expect(entry.latestVersion).toBe(0)
    expect(entry.coAuthorIds).toHaveLength(0)
  })

  it('keeps content exactly as given', async () => {
    const content = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Lysates were run.' }] }],
    }

    const saved = await EntryModel.create({ ...validEntry, content })
    const reloaded = await EntryModel.findById(saved._id).lean()

    expect(reloaded?.content).toEqual(content)
  })

  it.each([
    ['code', 'ELN-26-1'],
    ['kind', 'diary'],
    ['status', 'finished'],
    ['contentFormat', 'tiptap'],
    ['latestVersion', -1],
  ])('rejects %s %j', async (field, value) => {
    const errors = await validationErrors(new EntryModel({ ...validEntry, [field]: value }))

    expect(errors[field]).toBeDefined()
  })

  it('records where named entities came from', async () => {
    const valid = new EntryModel({
      ...validEntry,
      entities: [{ text: 'p53', label: 'gene', source: 'model' }],
    })
    const invalid = new EntryModel({
      ...validEntry,
      entities: [{ text: 'p53', label: 'gene', source: 'guess' }],
    })

    expect(await validationErrors(valid)).toEqual({})
    expect((await validationErrors(invalid))['entities.0.source']).toBeDefined()
  })

  it('allows only one entry per code', async () => {
    await EntryModel.create(validEntry)

    await expect(EntryModel.create(validEntry)).rejects.toThrow(/duplicate key/)
  })
})
