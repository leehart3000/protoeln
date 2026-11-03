import mongoose from 'mongoose'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { EntryChangeModel } from '../../src/data/models/entry-change.ts'
import { clearDatabase, startDatabase, stopDatabase, validationErrors } from '../database.ts'

beforeAll(startDatabase)
afterEach(clearDatabase)
afterAll(stopDatabase)

const entryId = new mongoose.Types.ObjectId()
const userId = new mongoose.Types.ObjectId()

describe('EntryChangeModel', () => {
  it('records who saved, when, and what changed', async () => {
    const change = await EntryChangeModel.create({
      entryId,
      userId,
      diff: [{ op: 'replace', path: '/title', value: 'Western blot (repeat)' }],
    })

    expect(change.savedAt).toBeInstanceOf(Date)
    expect(change.diff[0]?.value).toBe('Western blot (repeat)')
  })

  it('accepts only JSON Patch operations', async () => {
    const errors = await validationErrors(
      new EntryChangeModel({ entryId, userId, diff: [{ op: 'rewrite', path: '/title' }] }),
    )

    expect(errors['diff.0.op']).toBeDefined()
  })

  it('cannot be changed or deleted', async () => {
    const change = await EntryChangeModel.create({ entryId, userId })

    await expect(EntryChangeModel.deleteOne({ _id: change._id })).rejects.toThrow(
      'Entry changes cannot be changed or deleted',
    )
  })
})
