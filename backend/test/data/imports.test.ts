import { readFile } from 'node:fs/promises'
import { checkDocument } from '@protoeln/content'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { verifyVersions } from '../../src/data/entries.ts'
import { importRecords, type ImportPlan } from '../../src/data/imports.ts'
import { EntryModel } from '../../src/data/models/entry.ts'
import { NotebookModel } from '../../src/data/models/notebook.ts'
import { ProjectModel } from '../../src/data/models/project.ts'
import { UserModel } from '../../src/data/models/user.ts'
import { clearDatabase, startDatabase, stopDatabase } from '../database.ts'

const IMPORTER = '0000-0002-1825-0097'

function paragraph(text: string) {
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }
}

function record(id: string, publishedOn: string) {
  return {
    title: `Record ${id}`,
    kind: 'experiment' as const,
    tags: ['huntingtin'],
    url: `https://zenodo.org/records/${id}`,
    doi: `10.5281/zenodo.${id}`,
    authors: ['Harding, Rachel', 'Edwards, Aled'],
    publishedOn,
    licence: 'CC BY 4.0',
    citation: `Harding, R. (2017). Record ${id}. https://doi.org/10.5281/zenodo.${id}`,
    content: paragraph(`Write-up ${id}`),
  }
}

const plan: ImportPlan = {
  project: {
    code: 'HTT',
    title: 'Huntingtin open lab notebook',
    description: 'Imported',
    sourceRepository: 'https://zenodo.org',
    licence: 'CC BY 4.0',
    citation: '',
  },
  notebook: { title: 'Huntingtin', description: '' },
  // Not in the order they were published
  records: [record('2', '2017-07-19'), record('1', '2017-06-02')],
}

beforeAll(startDatabase)
beforeEach(async () => {
  await UserModel.create({ orcid: IMPORTER, name: 'Importer', lastSignedInAt: new Date() })
})
afterEach(clearDatabase)
afterAll(stopDatabase)

describe('importRecords', () => {
  it('adds a public project and notebook, and an entry with a version for each record', async () => {
    const result = await importRecords(plan, IMPORTER)

    const project = await ProjectModel.findOne({ code: 'HTT' }).orFail().lean()
    expect(project.publicRead).toBe(true)
    expect(project.licence).toBe('CC BY 4.0')
    expect(await NotebookModel.countDocuments({ projectId: project._id })).toBe(1)
    const entries = await EntryModel.find().sort({ code: 1 }).lean()
    // Oldest first
    expect(entries.map((entry) => entry.title)).toEqual(['Record 1', 'Record 2'])
    expect(result).toEqual({ projectCode: 'HTT', added: entries.map((e) => e.code), skipped: 0 })
    expect(entries[0]).toMatchObject({
      latestVersion: 1,
      tags: ['huntingtin'],
      source: {
        url: 'https://zenodo.org/records/1',
        doi: '10.5281/zenodo.1',
        authors: ['Harding, Rachel', 'Edwards, Aled'],
        publishedOn: '2017-06-02',
        licence: 'CC BY 4.0',
      },
    })
    expect(await verifyVersions(entries[0]!._id)).toEqual([])
  })

  it('shows the importer as the author, making no account for the original authors', async () => {
    await importRecords(plan, IMPORTER)

    const importer = await UserModel.findOne({ orcid: IMPORTER }).orFail().lean()
    const entries = await EntryModel.find().lean()
    expect(entries.every((entry) => entry.authorId.equals(importer._id))).toBe(true)
    expect(await UserModel.countDocuments()).toBe(1)
  })

  it('adds only the records not imported yet, when run again', async () => {
    await importRecords({ ...plan, records: [plan.records[0]!] }, IMPORTER)
    const result = await importRecords(plan, IMPORTER)

    expect(result.added).toHaveLength(1)
    expect(result.skipped).toBe(1)
    expect(await EntryModel.countDocuments()).toBe(2)
    expect(await NotebookModel.countDocuments()).toBe(1)
  })

  it('refuses an importer who has never signed in, or a project they are not in', async () => {
    await expect(importRecords(plan, '0000-0002-1694-233X')).rejects.toThrow(/has signed in/)

    await ProjectModel.create({ code: 'HTT', title: 'Someone else’s' })
    await expect(importRecords(plan, IMPORTER)).rejects.toThrow(/isn't a member/)
  })
})

describe('the Harding import', () => {
  it('has content in the content format for every record in its plan', async () => {
    const folder = new URL('../../imports/harding/', import.meta.url)
    const harding = JSON.parse(await readFile(new URL('plan.json', folder), 'utf8')) as {
      records: { id: string }[]
    }

    expect(harding.records.length).toBeGreaterThan(0)
    for (const { id } of harding.records) {
      const content = JSON.parse(await readFile(new URL(`content/${id}.json`, folder), 'utf8'))
      expect(checkDocument(content), id).toEqual([])
    }
  })
})
