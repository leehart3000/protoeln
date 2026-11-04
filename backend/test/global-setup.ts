import type { TestProject } from 'vitest/node'
import { MongoMemoryReplSet } from 'mongodb-memory-server-core'

// One temporary MongoDB server for the whole test run. Starting one per test file would make the
// files race to download the MongoDB server program on the first run. Each test file still gets a
// database of its own (see database.ts), so files running at the same time can't interfere.
//
// It runs as a one-member replica set, like MongoDB Atlas, because transactions (several changes
// saved together, or not at all) only work on a replica set.

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string
  }
}

export default async function setup(project: TestProject) {
  // Starting the server can take more than the usual 10 seconds on a busy machine
  const server = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    instanceOpts: [{ launchTimeout: 30_000 }],
  })
  project.provide('mongoUri', server.getUri())

  return async () => {
    await server.stop()
  }
}
