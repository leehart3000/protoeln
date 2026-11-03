import mongoose from 'mongoose'

import { createApp } from './app.ts'
import { readConfig } from './config.ts'
import { sessionAuthenticate } from './http/session-auth.ts'

// Runs the API under Node.js: connects to MongoDB, then listens. Settings come from environment
// variables, or locally from backend/.env (see .env.example).

const config = readConfig()
if (config.mongodbUri === undefined) {
  console.error('Set PROTOELN_MONGODB_URI to connect to MongoDB (see backend/.env.example)')
  process.exit(1)
}
if (config.orcid === null) {
  console.warn('Sign-in with ORCID is off: set PROTOELN_ORCID_CLIENT_ID and _CLIENT_SECRET')
}

await mongoose.connect(config.mongodbUri, { dbName: config.mongodbDatabase })
console.log(`Connected to MongoDB database ${config.mongodbDatabase}`)

const app = createApp({ authenticate: sessionAuthenticate(config.siteAdmins), config })
app.listen(config.port, '127.0.0.1', () => {
  console.log(`ProtoELN API listening on http://127.0.0.1:${config.port}`)
})
