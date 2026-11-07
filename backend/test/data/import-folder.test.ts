import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'

import { sha256Of } from '../../src/data/files.ts'
import { checkImport, readImportFolder } from '../../src/data/import-folder.ts'

// A small, invented import folder: one record showing one image
const folder = fileURLToPath(new URL('../fixtures/import/', import.meta.url))

describe('readImportFolder', () => {
  it('reads the plan, each record’s content, and the images', async () => {
    const plan = await readImportFolder(folder)

    expect(plan.project.code).toBe('IMP')
    expect(plan.records).toHaveLength(1)
    expect(plan.records[0]).toMatchObject({ title: 'Record 1', authors: ['Example, Ada'] })
    expect(plan.records[0]).not.toHaveProperty('id')
    expect(plan.files).toHaveLength(1)
    expect(plan.files[0]).toMatchObject({ contentType: 'image/png', name: 'gel.png', width: 2 })
  })
})

describe('checkImport', () => {
  it('finds nothing wrong with a good folder', async () => {
    expect(checkImport(await readImportFolder(folder))).toEqual([])
  })

  it('finds bad content, missing or changed images, and images with no description', async () => {
    const plan = await readImportFolder(folder)
    const [record] = plan.records
    const [image] = plan.files
    const changed = { ...image!, body: new Uint8Array([1, 2, 3]) }
    const content = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 9 } },
        { type: 'fileBlock', attrs: { fileId: image!.sha256 } },
        { type: 'fileBlock', attrs: { fileId: 'f'.repeat(64), alt: 'Missing' } },
      ],
    }

    const problems = checkImport({ ...plan, records: [{ ...record!, content }], files: [changed] })

    expect(problems).toEqual([
      `files/${image!.sha256}: its contents don't match its name`,
      'https://example.org/records/1: content[0].attrs.level should be 1, 2 or 3',
      `https://example.org/records/1: shows ${'f'.repeat(64)}, which isn't in files/`,
      `https://example.org/records/1: an image (${image!.sha256}) has no alt`,
    ])
  })

  it('needs no description for a spreadsheet, but refuses one with macros', async () => {
    const plan = await readImportFolder(folder)
    const csv = new TextEncoder().encode('a,b\n') as Uint8Array<ArrayBuffer>
    const xlsm = new TextEncoder().encode('PK xl/vbaProject.bin') as Uint8Array<ArrayBuffer>
    const sheet = (
      body: Uint8Array<ArrayBuffer>,
      contentType: 'text/csv' | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ) => ({
      sha256: sha256Of(body),
      body,
      contentType,
      name: 'data',
    })
    const content = {
      type: 'doc',
      content: [
        { type: 'fileBlock', attrs: { fileId: sha256Of(csv) } },
        { type: 'fileBlock', attrs: { fileId: sha256Of(xlsm) } },
      ],
    }

    const problems = checkImport({
      ...plan,
      records: [{ ...plan.records[0]!, content }],
      files: [
        sheet(csv, 'text/csv'),
        sheet(xlsm, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
      ],
    })

    expect(problems).toEqual([`files/${sha256Of(xlsm)}: Spreadsheets with macros are refused`])
  })
})
