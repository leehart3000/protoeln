import mongoose from 'mongoose'

import { readConfig } from './config.ts'
import { checkImport, readImportFolder } from './data/import-folder.ts'
import { importRecords } from './data/imports.ts'
import { s3Store } from './files/s3.ts'

// Imports published records into the database named in the settings (see docs/imports.md):
//
//   pnpm --dir backend import-records FOLDER --as ORCID-iD --into DATABASE
//
// `--as` is the ORCID iD of the person importing (who must have signed in to the site), shown
// as each entry's author. `--into` must repeat the database's name, so an import never goes
// into the wrong database by mistake. It writes to the database directly, so it works while
// the site is read-only.

function option(name: string) {
  const at = process.argv.indexOf(name)
  return at === -1 ? undefined : process.argv[at + 1]
}

const folder = process.argv[2]
const importer = option('--as')
const into = option('--into')
if (folder === undefined || folder.startsWith('--') || !importer || !into) {
  console.error('Usage: import-records FOLDER --as ORCID-iD --into DATABASE')
  process.exit(1)
}

const config = readConfig()
if (config.mongodbUri === undefined) {
  console.error('Set PROTOELN_MONGODB_URI to connect to MongoDB (see backend/.env.example)')
  process.exit(1)
}
if (into !== config.mongodbDatabase) {
  console.error(`The settings name the database "${config.mongodbDatabase}", not "${into}"`)
  process.exit(1)
}

// The import folder, checked before anything is written
const plan = await readImportFolder(folder)
const problems = checkImport(plan)
if (problems.length > 0) {
  for (const problem of problems) console.error(problem)
  process.exit(1)
}
const store = config.files ? s3Store(config.files) : null

await mongoose.connect(config.mongodbUri, { dbName: config.mongodbDatabase })
try {
  const result = await importRecords(plan, importer, store)
  console.log(
    `Project ${result.projectCode} in ${config.mongodbDatabase}: added ${result.added.length}` +
      ` entries (${result.added.join(', ') || 'none'}); ${result.skipped} were there already`,
  )
} finally {
  await mongoose.disconnect()
}
