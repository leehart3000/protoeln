import { readFile } from 'node:fs/promises'
import path from 'node:path'
import mongoose from 'mongoose'

import { readConfig } from './config.ts'
import {
  importRecords,
  type ImportedFile,
  type ImportedRecord,
  type ImportPlan,
} from './data/imports.ts'
import { s3Store } from './files/s3.ts'

// Imports published records into the database named in the settings (see imports/README.md):
//
//   pnpm --dir backend import-records imports/harding --as ORCID-iD --into DATABASE
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

// The plan (project, notebook and records), and each record's content from content/ID.json
type PlanFile = Omit<ImportPlan, 'records' | 'files'> & {
  records: (Omit<ImportedRecord, 'content'> & { id: string })[]
}
const plan = JSON.parse(await readFile(path.join(folder, 'plan.json'), 'utf8')) as PlanFile
const records = await Promise.all(
  plan.records.map(async ({ id, ...record }) => ({
    ...record,
    content: JSON.parse(await readFile(path.join(folder, 'content', `${id}.json`), 'utf8')),
  })),
)

// The images, as listed in files/files.json, each named by its SHA-256
type FileList = Record<string, Omit<ImportedFile, 'sha256' | 'body'>>
const filesFolder = path.join(folder, 'files')
const listed = JSON.parse(
  await readFile(path.join(filesFolder, 'files.json'), 'utf8').catch(() => '{}'),
) as FileList
const files = await Promise.all(
  Object.entries(listed).map(async ([sha256, file]) => {
    const extension = file.contentType === 'image/jpeg' ? 'jpg' : file.contentType.slice(6)
    const body = await readFile(path.join(filesFolder, `${sha256}.${extension}`))
    return { ...file, sha256, body: new Uint8Array(body) }
  }),
)
const store = config.files ? s3Store(config.files) : null

await mongoose.connect(config.mongodbUri, { dbName: config.mongodbDatabase })
try {
  const result = await importRecords({ ...plan, records, files }, importer, store)
  console.log(
    `Project ${result.projectCode} in ${config.mongodbDatabase}: added ${result.added.length}` +
      ` entries (${result.added.join(', ') || 'none'}); ${result.skipped} were there already`,
  )
} finally {
  await mongoose.disconnect()
}
