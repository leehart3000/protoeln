import { createHash } from 'node:crypto'
import mongoose from 'mongoose'

import { fileKey, type FileStore } from '../files/store.ts'
import { FileModel, IMAGE_TYPES } from './models/file.ts'
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

// Keeps a file, if it isn't kept already, and records it. Returns its SHA-256, which is its id
// in entry content (fileBlock).
export async function storeFile(input: {
  store: FileStore
  body: Uint8Array<ArrayBuffer>
  contentType: (typeof IMAGE_TYPES)[number]
  name: string
  width?: number
  height?: number
  userId: mongoose.Types.ObjectId | string
}) {
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

export async function findFile(sha256: string) {
  return SHA256_HEX.test(sha256) ? FileModel.findOne({ sha256 }).lean() : null
}
