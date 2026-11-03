import mongoose from 'mongoose'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { EntryVersionModel } from '../../src/data/models/entry-version.ts'
import { clearDatabase, startDatabase, stopDatabase, validationErrors } from '../database.ts'

beforeAll(startDatabase)
afterEach(clearDatabase)
afterAll(stopDatabase)

const entryId = new mongoose.Types.ObjectId()

const validVersion = {
  entryId,
  number: 1,
  title: 'Western blot',
  contentFormat: 'protoeln-doc/1',
  content: { type: 'doc', content: [] },
  createdBy: new mongoose.Types.ObjectId(),
  createdAt: new Date('2026-11-03T12:00:00Z'),
  hash: 'a'.repeat(64),
} as const

describe('EntryVersionModel', () => {
  it('saves a version, with no previous hash for version 1', async () => {
    const version = await EntryVersionModel.create(validVersion)

    expect(version.previousHash).toBeNull()
    expect(version.note).toBe('')
  })

  it.each([
    ['number', 0],
    ['hash', 'not-a-hash'],
    ['previousHash', 'ABC'],
    ['contentFormat', 'tiptap'],
  ])('rejects %s %j', async (field, value) => {
    const errors = await validationErrors(
      new EntryVersionModel({ ...validVersion, [field]: value }),
    )

    expect(errors[field]).toBeDefined()
  })

  it('allows each version number only once per entry', async () => {
    await EntryVersionModel.create(validVersion)

    await expect(EntryVersionModel.create(validVersion)).rejects.toThrow(/duplicate key/)
  })

  it('cannot be changed or deleted', async () => {
    const version = await EntryVersionModel.create(validVersion)

    await expect(
      EntryVersionModel.updateOne({ _id: version._id }, { title: 'Changed' }),
    ).rejects.toThrow('Entry versions cannot be changed or deleted')
    await expect(EntryVersionModel.deleteMany({})).rejects.toThrow(/cannot be changed/)
    await expect(version.deleteOne()).rejects.toThrow(/cannot be changed/)

    version.title = 'Changed'
    await expect(version.save()).rejects.toThrow(/cannot be changed/)

    const stored = await EntryVersionModel.findById(version._id).lean()
    expect(stored?.title).toBe('Western blot')
  })
})
