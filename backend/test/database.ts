import { randomUUID } from 'node:crypto'

import mongoose from 'mongoose'
import { inject } from 'vitest'

// Connects a test file to a database of its own on the temporary MongoDB server started in
// global-setup.ts. The first run downloads the MongoDB server program, which can take a minute.

export async function startDatabase() {
  await mongoose.connect(inject('mongoUri'), { dbName: `test-${randomUUID()}` })
  // Build the indexes (such as unique ones) of every model the test file has imported
  await mongoose.connection.syncIndexes()
}

export async function stopDatabase() {
  await mongoose.connection.dropDatabase()
  await mongoose.disconnect()
}

export async function clearDatabase() {
  const collections = await mongoose.connection.db?.collections()
  for (const collection of collections ?? []) {
    await collection.deleteMany({})
  }
}

// The validation errors of a document, by field, without saving it ({} if it is valid)
export async function validationErrors(
  document: mongoose.Document,
): Promise<mongoose.Error.ValidationError['errors']> {
  try {
    await document.validate()
    return {}
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return error.errors
    }
    throw error
  }
}
