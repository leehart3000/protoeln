import mongoose, { type InferSchemaType } from 'mongoose'

import { makeImmutable } from '../immutable.ts'
import { patchOperationSchema } from './entry-change.ts'

// The kinds of record whose details are changed this way (entries have their own changes)
export const CHANGED_RECORD_KINDS = ['project', 'notebook'] as const

// One record per change to a project's or notebook's details (its title, description, and for
// a project whether it's public): which record, who changed it, when, and what changed, as
// JSON Patch operations like an entry's changes. Together they form the record's audit trail,
// so they are never changed or deleted.
const recordChangeSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: CHANGED_RECORD_KINDS, required: true },
    recordId: { type: mongoose.Schema.Types.ObjectId, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    savedAt: { type: Date, required: true, default: Date.now },
    diff: { type: [patchOperationSchema], default: [] },
  },
  { collection: 'record_changes' },
)

recordChangeSchema.index({ kind: 1, recordId: 1, savedAt: 1 })
makeImmutable(recordChangeSchema, 'Record changes')

export type RecordChange = InferSchemaType<typeof recordChangeSchema>
export const RecordChangeModel = mongoose.model('RecordChange', recordChangeSchema)
