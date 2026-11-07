import mongoose, { type InferSchemaType } from 'mongoose'

import { makeImmutable } from '../immutable.ts'

// The kinds of file that can be shown in entries: images that browsers show safely (SVG isn't
// one of them, as it can carry scripts), and spreadsheets, which are only ever downloaded
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const
export const SPREADSHEET_TYPES = [
  // .xlsx (without macros: a workbook with macros is refused, see data/files.ts)
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // .xls, the older Excel format
  'application/vnd.ms-excel',
  'text/csv',
] as const
export const FILE_TYPES = [...IMAGE_TYPES, ...SPREADSHEET_TYPES] as const
export type FileType = (typeof FILE_TYPES)[number]

// The file name extension for each kind of file, as files are named in import folders
export const EXTENSIONS: Record<FileType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xls',
  'text/csv': 'csv',
}

export function isImage(contentType: string) {
  return (IMAGE_TYPES as readonly string[]).includes(contentType)
}

const SHA256_HEX = /^[0-9a-f]{64}$/

// A file kept in the file store (see files/store.ts), found by its SHA-256, which is also its
// id in entry content (fileBlock). The bytes are in the store; this records what they are.
// Like the bytes, it never changes.
const fileSchema = new mongoose.Schema(
  {
    sha256: { type: String, required: true, unique: true, match: SHA256_HEX },
    contentType: { type: String, enum: FILE_TYPES, required: true },
    size: { type: Number, required: true, min: 0 },
    // Its name when it was added, such as "gel.png" (a download keeps it)
    name: { type: String, default: '' },
    // An image's size in pixels, so pages can leave room for it before it loads
    width: { type: Number, min: 1 },
    height: { type: Number, min: 1 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { collection: 'files' },
)

makeImmutable(fileSchema, 'Files')

export type FileRecord = InferSchemaType<typeof fileSchema>
export const FileModel = mongoose.model('File', fileSchema)
