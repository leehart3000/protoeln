import { checkImport, readImportFolder } from './data/import-folder.ts'
import { isImage } from './data/models/file.ts'

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
const images = plan.files.filter((file) => isImage(file.contentType)).length
const others = plan.files.length - images
console.log(
  `${folder}: ${plan.records.length} records, ${images} images and ${others} other files` +
    ' (such as spreadsheets), all fine',
)
