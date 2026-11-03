import type mongoose from 'mongoose'

const CHANGING_QUERIES = [
  'updateOne',
  'updateMany',
  'replaceOne',
  'findOneAndUpdate',
  'findOneAndReplace',
  'findOneAndDelete',
  'deleteOne',
  'deleteMany',
] as const

// Makes a collection's records write-once through the app: they can be created, but not
// changed or deleted. (Redaction, when it comes, will have its own controlled route.)
export function makeImmutable(schema: mongoose.Schema, description: string) {
  const refuse = () => {
    throw new Error(`${description} cannot be changed or deleted`)
  }
  schema.pre([...CHANGING_QUERIES], refuse)
  schema.pre('deleteOne', { document: true, query: false }, refuse)
  schema.pre('save', function () {
    if (!this.isNew) {
      refuse()
    }
  })
}
