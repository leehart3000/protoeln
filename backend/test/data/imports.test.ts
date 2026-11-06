import { readFile } from 'node:fs/promises'
import { checkDocument, fileIdsOf, type DocNode, type FileBlockNode } from '@protoeln/content'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { verifyVersions } from '../../src/data/entries.ts'
import { sha256Of } from '../../src/data/files.ts'
import { importRecords, type ImportPlan } from '../../src/data/imports.ts'
import { EntryModel } from '../../src/data/models/entry.ts'
import { FileModel } from '../../src/data/models/file.ts'
import { NotebookModel } from '../../src/data/models/notebook.ts'
import { ProjectModel } from '../../src/data/models/project.ts'
import { UserModel } from '../../src/data/models/user.ts'
import { fileKey, memoryStore } from '../../src/files/store.ts'
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
    changes: 'Converted from Word',
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
  files: [],
}

const store = memoryStore()

beforeAll(startDatabase)
beforeEach(async () => {
  await UserModel.create({ orcid: IMPORTER, name: 'Importer', lastSignedInAt: new Date() })
})
afterEach(clearDatabase)
afterAll(stopDatabase)

describe('importRecords', () => {
  it('adds a public project and notebook, and an entry with a version for each record', async () => {
    const result = await importRecords(plan, IMPORTER, store)

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
    await importRecords(plan, IMPORTER, store)

    const importer = await UserModel.findOne({ orcid: IMPORTER }).orFail().lean()
    const entries = await EntryModel.find().lean()
    expect(entries.every((entry) => entry.authorId.equals(importer._id))).toBe(true)
    expect(await UserModel.countDocuments()).toBe(1)
  })

  it('adds only the records not imported yet, when run again', async () => {
    await importRecords({ ...plan, records: [plan.records[0]!] }, IMPORTER, store)
    const result = await importRecords(plan, IMPORTER, store)

    expect(result.added).toHaveLength(1)
    expect(result.skipped).toBe(1)
    expect(await EntryModel.countDocuments()).toBe(2)
    expect(await NotebookModel.countDocuments()).toBe(1)
  })

  it('keeps the images the records show, before adding the entries', async () => {
    const body = new TextEncoder().encode('a gel') as Uint8Array<ArrayBuffer>
    const sha256 = sha256Of(body)
    const withImage = {
      ...record('3', '2017-08-01'),
      content: { type: 'doc', content: [{ type: 'fileBlock', attrs: { fileId: sha256 } }] },
    }
    const image = {
      sha256,
      body,
      contentType: 'image/png' as const,
      name: 'gel.png',
      width: 2,
      height: 1,
    }

    await importRecords({ ...plan, records: [withImage], files: [image] }, IMPORTER, store)

    expect(await store.has(fileKey(sha256))).toBe(true)
    expect(await FileModel.findOne({ sha256 }).lean()).toMatchObject({ name: 'gel.png', width: 2 })
    expect((await EntryModel.findOne().orFail().lean()).files).toEqual([sha256])
  })

  it('refuses records that show images it has not got, or no file store to keep them in', async () => {
    const withImage = {
      ...record('3', '2017-08-01'),
      content: { type: 'doc', content: [{ type: 'fileBlock', attrs: { fileId: 'f'.repeat(64) } }] },
    }

    await expect(importRecords({ ...plan, records: [withImage] }, IMPORTER, store)).rejects.toThrow(
      /has no file/,
    )
    const body = new TextEncoder().encode('x') as Uint8Array<ArrayBuffer>
    const named = {
      ...withImage,
      content: { type: 'doc', content: [{ type: 'fileBlock', attrs: { fileId: sha256Of(body) } }] },
    }
    const file = {
      sha256: sha256Of(body),
      body,
      contentType: 'image/png' as const,
      name: 'x.png',
      width: 1,
      height: 1,
    }
    await expect(
      importRecords({ ...plan, records: [named], files: [file] }, IMPORTER, null),
    ).rejects.toThrow(/no file store/)
    expect(await EntryModel.countDocuments()).toBe(0)
  })

  it('refuses an importer who has never signed in, or a project they are not in', async () => {
    await expect(importRecords(plan, '0000-0002-1694-233X', store)).rejects.toThrow(/has signed in/)

    await ProjectModel.create({ code: 'HTT', title: 'Someone else’s' })
    await expect(importRecords(plan, IMPORTER, store)).rejects.toThrow(/isn't a member/)
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

  it('has every image its records show, each named by its SHA-256 and described', async () => {
    const folder = new URL('../../imports/harding/', import.meta.url)
    const harding = JSON.parse(await readFile(new URL('plan.json', folder), 'utf8')) as {
      records: { id: string }[]
    }
    const listed = JSON.parse(
      await readFile(new URL('files/files.json', folder), 'utf8'),
    ) as Record<string, { contentType: string }>

    for (const { id } of harding.records) {
      const content = JSON.parse(
        await readFile(new URL(`content/${id}.json`, folder), 'utf8'),
      ) as DocNode
      for (const sha256 of fileIdsOf(content)) {
        const extension = listed[sha256]?.contentType === 'image/jpeg' ? 'jpg' : 'png'
        const body = await readFile(new URL(`files/${sha256}.${extension}`, folder))
        expect(sha256Of(body), id).toBe(sha256)
      }
      for (const block of content.content.filter(
        (node): node is FileBlockNode => node.type === 'fileBlock',
      )) {
        expect(block.attrs.alt, id).toBeTruthy()
      }
    }
  })
})
