import mongoose from 'mongoose'

// Counters hand out the next number in a sequence, such as entry numbers for ELN-2026-0042.
// Each counter is one document, named by its _id; incrementing it is a single atomic operation,
// so two requests at the same moment never get the same number.

const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    value: { type: Number, required: true },
  },
  { collection: 'counters', versionKey: false },
)

export const CounterModel = mongoose.model('Counter', counterSchema)

export async function nextValue(name: string): Promise<number> {
  const counter = await CounterModel.findOneAndUpdate(
    { _id: name },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: 'after' },
  )
  // With upsert, a document is always returned; this only satisfies the type checker
  /* v8 ignore start */
  if (counter === null) {
    throw new Error(`Counter ${name} could not be incremented`)
  }
  /* v8 ignore stop */
  return counter.value
}

// Entry codes are numbered from 1 each calendar year (UTC), e.g. ELN-2026-0042
export async function nextEntryCode(now: Date = new Date()): Promise<string> {
  const year = now.getUTCFullYear()
  const number = await nextValue(`entry-${year}`)
  return `ELN-${year}-${String(number).padStart(4, '0')}`
}
