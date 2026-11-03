import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { addDemoData, DEMO_PROJECT_CODE } from '../../src/data/demo.ts'
import { verifyVersions } from '../../src/data/entries.ts'
import { EntryModel } from '../../src/data/models/entry.ts'
import { NotebookModel } from '../../src/data/models/notebook.ts'
import { ProjectModel } from '../../src/data/models/project.ts'
import { clearDatabase, startDatabase, stopDatabase } from '../database.ts'

beforeAll(startDatabase)
afterEach(clearDatabase)
afterAll(stopDatabase)

describe('addDemoData', () => {
  it('adds a public example project with a notebook and entries', async () => {
    const result = await addDemoData()

    const project = await ProjectModel.findOne({ code: DEMO_PROJECT_CODE }).orFail().lean()
    const notebooks = await NotebookModel.find({ projectId: project._id }).lean()
    const entries = await EntryModel.find().sort({ code: 1 }).lean()
    expect(result.added).toBe(true)
    expect(project.publicRead).toBe(true)
    expect(notebooks).toHaveLength(1)
    expect(entries.map((entry) => [entry.kind, entry.latestVersion])).toEqual([
      ['protocol', 1],
      ['experiment', 2],
      ['note', 0],
    ])
    expect(result.entryCodes).toEqual(entries.map((entry) => entry.code))
  })

  it('records versions whose history checks out', async () => {
    await addDemoData()

    for (const entry of await EntryModel.find().lean()) {
      expect(await verifyVersions(entry._id)).toEqual([])
    }
  })

  it('adds nothing if the example project is there already', async () => {
    await addDemoData()

    const again = await addDemoData()

    expect(again.added).toBe(false)
    expect(await ProjectModel.countDocuments()).toBe(1)
    expect(await EntryModel.countDocuments()).toBe(3)
  })
})
