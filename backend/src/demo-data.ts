import mongoose from 'mongoose'

import { readConfig } from './config.ts'
import { addDemoData, DEMO_PROJECT_CODE } from './data/demo.ts'

// Adds the example data (see data/demo.ts) to the database named in the settings. It only writes
// to a development database, whose name ends in "-dev", and never changes data already there.

const config = readConfig()
const database = config.mongodbDatabase
if (config.mongodbUri === undefined) {
  console.error('Set PROTOELN_MONGODB_URI to connect to MongoDB (see backend/.env.example)')
  process.exit(1)
}
if (!database.endsWith('-dev')) {
  console.error(`Example data only goes in a development database, not "${database}"`)
  process.exit(1)
}

await mongoose.connect(config.mongodbUri, { dbName: database })
try {
  const { added, entryCodes } = await addDemoData()
  console.log(
    added
      ? `Added project ${DEMO_PROJECT_CODE} to ${database}, with entries ${entryCodes.join(', ')}`
      : `${database} already has project ${DEMO_PROJECT_CODE}, so nothing was added`,
  )
} finally {
  await mongoose.disconnect()
}
