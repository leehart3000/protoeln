import { checkImport, readImportFolder } from './data/import-folder.ts'

// Checks an import folder without connecting to any database (see docs/imports.md):
//
//   pnpm --dir backend check-import FOLDER

const folder = process.argv[2]
if (folder === undefined) {
  console.error('Usage: check-import FOLDER')
  process.exit(1)
}

const plan = await readImportFolder(folder)
const problems = checkImport(plan)
for (const problem of problems) console.error(problem)
if (problems.length > 0) process.exit(1)
console.log(`${folder}: ${plan.records.length} records and ${plan.files.length} images, all fine`)
