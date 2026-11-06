import mongoose, { type InferSchemaType } from 'mongoose'

import { makeImmutable } from '../immutable.ts'

// One operation of a JSON Patch (RFC 6902), describing part of what a save changed
export const patchOperationSchema = new mongoose.Schema(
  {
    op: {
      type: String,
      enum: ['add', 'remove', 'replace', 'move', 'copy', 'test'],
      required: true,
    },
    path: { type: String, required: true },
    from: { type: String },
    value: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false, minimize: false },
)

// One record per save of an entry's draft: who saved it, when, and what changed. Together they
// form the entry's audit trail, so they are never changed or deleted.
const entryChangeSchema = new mongoose.Schema(
  {
    entryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Entry', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    savedAt: { type: Date, required: true, default: Date.now },
    diff: { type: [patchOperationSchema], default: [] },
  },
  { collection: 'entry_changes' },
)

entryChangeSchema.index({ entryId: 1, savedAt: 1 })
makeImmutable(entryChangeSchema, 'Entry changes')

export type EntryChange = InferSchemaType<typeof entryChangeSchema>
export const EntryChangeModel = mongoose.model('EntryChange', entryChangeSchema)
