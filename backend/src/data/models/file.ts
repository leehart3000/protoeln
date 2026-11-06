import mongoose, { type InferSchemaType } from 'mongoose'

import { makeImmutable } from '../immutable.ts'

// The kinds of file that can be shown in entries: images that browsers show safely. (SVG isn't
// one of them, as it can carry scripts.)
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const

const SHA256_HEX = /^[0-9a-f]{64}$/

// A file kept in the file store (see files/store.ts), found by its SHA-256, which is also its
// id in entry content (fileBlock). The bytes are in the store; this records what they are.
// Like the bytes, it never changes.
const fileSchema = new mongoose.Schema(
  {
    sha256: { type: String, required: true, unique: true, match: SHA256_HEX },
    contentType: { type: String, enum: IMAGE_TYPES, required: true },
    size: { type: Number, required: true, min: 0 },
    // Its name when it was added, such as "gel.png"
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
