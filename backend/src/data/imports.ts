import { fileIdsOf, type DocNode } from '@protoeln/content'

import { ConflictError, NotFoundError } from '../errors.ts'
import type { FileStore } from '../files/store.ts'
import { createEntry, createVersion, type EntrySource } from './entries.ts'
import { storeFile } from './files.ts'
import type { FileType } from './models/file.ts'
import { EntryModel, type ENTRY_KINDS } from './models/entry.ts'
import { NotebookModel } from './models/notebook.ts'
import { ProjectModel } from './models/project.ts'
import { UserModel } from './models/user.ts'
import { createNotebook } from './notebooks.ts'

// Importing published records, such as the write-ups of an open lab notebook on Zenodo, into a
// project and notebook of their own (see docs/imports.md). Each record becomes an entry
// with a first version, crediting its original authors by name (`source`). The person who
// runs the import is shown as the entry's author ("Imported by"): no account is made in anyone
// else's name. Importing again adds only the records not imported yet, and never changes
// anything already there.

export interface ImportedRecord extends EntrySource {
  title: string
  kind: (typeof ENTRY_KINDS)[number]
  tags: string[]
  // In protoeln-doc/1 (see tools/docx_to_protoeln.py)
  content: unknown
}

export interface ImportPlan {
  project: {
    code: string
    title: string
    description: string
    sourceRepository: string
    licence: string
    citation: string
  }
  notebook: { title: string; description: string }
  records: ImportedRecord[]
  // The images the records show, by SHA-256 (see tools/docx_to_protoeln.py)
  files: ImportedFile[]
}

export interface ImportedFile {
  sha256: string
  body: Uint8Array<ArrayBuffer>
  contentType: FileType
  name: string
  // An image's size in pixels
  width?: number
  height?: number
}

// Imports the plan's records, as the person with the ORCID iD `importer` (who must have signed
// in to the site before), keeping their images in `store`. Returns the codes of the entries
// added, and how many records were there already.
export async function importRecords(plan: ImportPlan, importer: string, store: FileStore | null) {
  const user = await UserModel.findOne({ orcid: importer }).lean()
  if (user === null) {
    throw new NotFoundError(`No one with the ORCID iD ${importer} has signed in to this site`)
  }

  const existing = await ProjectModel.findOne({ code: plan.project.code }).lean()
  if (existing !== null && !existing.members.some((member) => member.userId.equals(user._id))) {
    throw new ConflictError(
      `There is already a project ${plan.project.code}, which ${importer} isn't a member of`,
    )
  }
  // Every image a record shows must be in the plan, and kept, before any entry shows it
  const files = new Map(plan.files.map((file) => [file.sha256, file]))
  const needed = new Set(plan.records.flatMap((record) => fileIdsOf(record.content as DocNode)))
  for (const sha256 of needed) {
    if (!files.has(sha256)) throw new NotFoundError(`The plan has no file ${sha256}`)
  }
  if (needed.size > 0 && store === null) {
    throw new ConflictError('The records show images, but no file store is set up')
  }
  for (const sha256 of needed) {
    const { body, contentType, name, width, height } = files.get(sha256)!
    const kept = await storeFile({
      store: store!,
      body,
      contentType,
      name,
      width,
      height,
      userId: user._id,
    })
    if (kept !== sha256) throw new ConflictError(`The file ${name} isn't the one the plan names`)
  }

  const project =
    existing ??
    (
      await ProjectModel.create({
        ...plan.project,
        publicRead: true,
        members: [{ userId: user._id, role: 'admin' }],
      })
    ).toObject()

  const notebook =
    (await NotebookModel.findOne({ projectId: project._id, title: plan.notebook.title }).lean()) ??
    (await createNotebook({ projectId: project._id, ownerId: String(user._id), ...plan.notebook }))

  // Oldest first, so the entries' codes follow the order the records were published in
  const records = [...plan.records].sort((a, b) => a.publishedOn.localeCompare(b.publishedOn))
  const added: string[] = []
  let skipped = 0
  for (const record of records) {
    if ((await EntryModel.exists({ 'source.url': record.url })) !== null) {
      skipped += 1
      continue
    }
    const { title, kind, tags, content, ...source } = record
    const entry = await createEntry({
      notebookId: notebook._id,
      authorId: user._id,
      kind,
      title,
      content,
      tags,
      source,
    })
    await createVersion({
      entryId: entry._id,
      userId: user._id,
      note: `Imported from ${record.url}`,
    })
    added.push(entry.code)
  }
  return { projectCode: project.code, added, skipped }
}
