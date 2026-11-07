import { createHash } from 'node:crypto'
import mongoose from 'mongoose'

import { fileKey, type FileStore } from '../files/store.ts'
import { ConflictError } from '../errors.ts'
import { FileModel, type FileType } from './models/file.ts'
import { EntryVersionModel } from './models/entry-version.ts'
import { EntryModel } from './models/entry.ts'
import { NotebookModel } from './models/notebook.ts'
import { ProjectModel } from './models/project.ts'

// Files shown in entries, such as images: their bytes are in the file store (files/store.ts),
// and each is recorded once (models/file.ts), found by its SHA-256.

export const SHA256_HEX = /^[0-9a-f]{64}$/

export function sha256Of(body: Uint8Array) {
  return createHash('sha256').update(body).digest('hex')
}

// The largest file kept: the API reads a file whole to serve it
export const MAX_FILE_BYTES = 25 * 1024 * 1024

function contains(body: Uint8Array, text: string, encoding: 'latin1' | 'utf16le') {
  return Buffer.from(body.buffer, body.byteOffset, body.byteLength).includes(
    Buffer.from(text, encoding),
  )
}

// Why a file can't be kept, if it can't: it's too big, or it's an Office file with macros
// (programs that could run when it's opened). An .xlsx or .docx with macros holds a
// vbaProject.bin part; an .xls holds a _VBA_PROJECT part, named in UTF-16.
export function refusal(body: Uint8Array, contentType: FileType): string | null {
  if (body.byteLength > MAX_FILE_BYTES) {
    return `Files can be at most ${MAX_FILE_BYTES / 1024 / 1024} MB`
  }
  const macros =
    ((contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') &&
      contains(body, 'vbaProject.bin', 'latin1')) ||
    (contentType === 'application/vnd.ms-excel' && contains(body, '_VBA_PROJECT', 'utf16le'))
  return macros ? 'Files with macros are refused' : null
}

// Keeps a file, if it isn't kept already, and records it. Returns its SHA-256, which is its id
// in entry content (fileBlock). Refuses a file that's too big or has macros (see refusal).
export async function storeFile(input: {
  store: FileStore
  body: Uint8Array<ArrayBuffer>
  contentType: FileType
  name: string
  width?: number
  height?: number
  userId: mongoose.Types.ObjectId | string
}) {
  const refused = refusal(input.body, input.contentType)
  if (refused !== null) throw new ConflictError(`${input.name}: ${refused}`)
  const sha256 = sha256Of(input.body)
  if (!(await input.store.has(fileKey(sha256)))) {
    await input.store.put(fileKey(sha256), input.body, input.contentType)
  }
  if ((await FileModel.exists({ sha256 })) === null) {
    await FileModel.create({
      sha256,
      contentType: input.contentType,
      size: input.body.byteLength,
      name: input.name,
      width: input.width,
      height: input.height,
      createdBy: input.userId,
    })
  }
  return sha256
}

// The projects whose entries show this file, in a draft or a version: whoever can read one of
// them can see the file
export async function projectsShowing(sha256: string) {
  const [drafts, inVersions] = await Promise.all([
    EntryModel.find({ files: sha256 }).select('notebookId').lean(),
    EntryVersionModel.distinct('entryId', { files: sha256 }),
  ])
  const versioned = await EntryModel.find({ _id: { $in: inVersions } })
    .select('notebookId')
    .lean()
  const notebookIds = [...drafts, ...versioned].map((entry) => entry.notebookId)
  const projectIds = await NotebookModel.distinct('projectId', { _id: { $in: notebookIds } })
  return ProjectModel.find({ _id: { $in: projectIds } }).lean()
}

// The name, type and size of each file a document shows, by SHA-256, so pages can show
// other files as downloads with their names (and know which files are images)
export async function fileInfoFor(sha256s: string[]) {
  if (sha256s.length === 0) return {}
  const files = await FileModel.find({ sha256: { $in: sha256s } })
    .select('sha256 name contentType size')
    .lean()
  return Object.fromEntries(
    files.map((file) => [
      file.sha256,
      { name: file.name, contentType: file.contentType, size: file.size },
    ]),
  )
}

export async function findFile(sha256: string) {
  return SHA256_HEX.test(sha256) ? FileModel.findOne({ sha256 }).lean() : null
}
