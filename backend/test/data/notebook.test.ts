import mongoose from 'mongoose'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { NotebookModel } from '../../src/data/models/notebook.ts'
import { clearDatabase, startDatabase, stopDatabase, validationErrors } from '../database.ts'

beforeAll(startDatabase)
afterEach(clearDatabase)
afterAll(stopDatabase)

const projectId = new mongoose.Types.ObjectId()
const ownerId = new mongoose.Types.ObjectId()

describe('NotebookModel', () => {
  it('saves a notebook in a project, with an owner', async () => {
    const notebook = await NotebookModel.create({ projectId, ownerId, title: 'Western blots' })

    expect(notebook.description).toBe('')
    expect(notebook.createdAt).toBeInstanceOf(Date)
  })

  it('requires a project, an owner and a title', async () => {
    const errors = await validationErrors(new NotebookModel({}))

    expect(Object.keys(errors).sort()).toEqual(['ownerId', 'projectId', 'title'])
  })
})
