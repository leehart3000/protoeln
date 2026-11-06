import mongoose, { type InferSchemaType } from 'mongoose'

import { makeImmutable } from '../immutable.ts'
import { CONTENT_FORMAT } from './entry.ts'

const SHA256_HEX = /^[0-9a-f]{64}$/

// A full, numbered snapshot of an entry, made deliberately. Versions are never changed or deleted.
const entryVersionSchema = new mongoose.Schema(
  {
    entryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entry', required: true },
    // 1 for an entry's first version, then 2, 3 and so on
    number: { type: Number, required: true, min: 1 },
    title: { type: String, required: true },
    contentFormat: { type: String, enum: [CONTENT_FORMAT], required: true },
    content: { type: mongoose.Schema.Types.Mixed, required: true },
    // Plain-text and Markdown copies, readable without any editor
    text: { type: String, default: '' },
    markdown: { type: String, default: '' },
    // The codes of the entries the content links to (as for an entry's draft)
    linkedEntries: { type: [String], default: [] },
    note: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Set explicitly (not by Mongoose's timestamps), because it is part of what the hash protects
    createdAt: { type: Date, required: true },
    // The hash of the version before (null for version 1), and of this version
    previousHash: { type: String, default: null, match: SHA256_HEX },
    hash: { type: String, required: true, match: SHA256_HEX },
  },
  { collection: 'entry_versions', minimize: false },
)

entryVersionSchema.index({ entryId: 1, number: 1 }, { unique: true })
entryVersionSchema.index({ linkedEntries: 1 })
makeImmutable(entryVersionSchema, 'Entry versions')

export type EntryVersion = InferSchemaType<typeof entryVersionSchema>
export const EntryVersionModel = mongoose.model('EntryVersion', entryVersionSchema)
