import type mongoose from 'mongoose'

import { diffJson } from '../integrity/json-patch.ts'
import { RecordChangeModel, type CHANGED_RECORD_KINDS } from './models/record-change.ts'

// Changing a project's or notebook's details. Only the details given change; each change is
// recorded (see models/record-change.ts), in the same transaction as the record itself, so a
// record never changes without its change being kept.

type Kind = (typeof CHANGED_RECORD_KINDS)[number]

// The details given, leaving out any not given (undefined)
export function givenOnly<T extends object>(details: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== undefined),
  ) as Partial<T>
}

// Saves the record with its new details, and records exactly what changed, if anything did.
// Says whether anything changed.
export async function saveDetails<T extends object>(input: {
  kind: Kind
  record: mongoose.Document
  before: T
  changes: Partial<T>
  userId: string
  session: mongoose.ClientSession
}) {
  const after = { ...input.before, ...givenOnly(input.changes) }
  const diff = diffJson(input.before, after)
  if (diff.length === 0) return false

  input.record.set(after)
  await input.record.save({ session: input.session })
  await RecordChangeModel.create(
    [{ kind: input.kind, recordId: input.record._id, userId: input.userId, diff }],
    { session: input.session },
  )
  return true
}
