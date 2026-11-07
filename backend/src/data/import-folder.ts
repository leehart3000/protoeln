import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { checkDocument, fileIdsOf, type DocNode, type FileBlockNode } from '@protoeln/content'

import { sha256Of } from './files.ts'
import type { ImportedFile, ImportedRecord, ImportPlan } from './imports.ts'
import { IMAGE_TYPES } from './models/file.ts'

// An import folder (see docs/imports.md): plan.json (the project, notebook and records),
// content/ID.json (each record's write-up), and files/ (its images, each named by its SHA-256,
// listed in files/files.json). Import folders are kept outside the repository, with the site
// they're for, as their data isn't part of ProtoELN.

type PlanFile = Omit<ImportPlan, 'records' | 'files'> & {
  records: (Omit<ImportedRecord, 'content'> & { id: string })[]
}
type FileList = Record<string, Omit<ImportedFile, 'sha256' | 'body'>>

function extensionOf(contentType: string) {
  return contentType === 'image/jpeg' ? 'jpg' : contentType.slice('image/'.length)
}

// Reads an import folder. Missing files make it fail, naming them.
export async function readImportFolder(folder: string): Promise<ImportPlan> {
  const json = async (...parts: string[]) =>
    JSON.parse(await readFile(path.join(folder, ...parts), 'utf8')) as unknown
  const plan = (await json('plan.json')) as PlanFile
  const records = await Promise.all(
    plan.records.map(async ({ id, ...record }) => ({
      ...record,
      content: await json('content', `${id}.json`),
    })),
  )
  const listed = (await json('files', 'files.json').catch(() => ({}))) as FileList
  const files = await Promise.all(
    Object.entries(listed).map(async ([sha256, file]) => {
      const name = `${sha256}.${extensionOf(file.contentType)}`
      const body = await readFile(path.join(folder, 'files', name))
      return { ...file, sha256, body: new Uint8Array(body) }
    }),
  )
  return { ...plan, records, files }
}

// What's wrong with an import, if anything: content not in the content format, images not in
// the folder, or not matching their names, or of a kind that isn't allowed, and images with no
// description (alt text)
export function checkImport(plan: ImportPlan): string[] {
  const problems: string[] = []
  const files = new Map(plan.files.map((file) => [file.sha256, file]))
  for (const file of plan.files) {
    if (sha256Of(file.body) !== file.sha256) {
      problems.push(`files/${file.sha256}: its contents don't match its name`)
    }
    if (!(IMAGE_TYPES as readonly string[]).includes(file.contentType)) {
      problems.push(`files/${file.sha256}: ${file.contentType} isn't an image type allowed`)
    }
  }
  for (const record of plan.records) {
    const where = record.url
    for (const problem of checkDocument(record.content)) {
      problems.push(`${where}: ${problem.path} ${problem.message}`)
    }
    const content = record.content as DocNode
    for (const sha256 of fileIdsOf(content)) {
      if (!files.has(sha256)) problems.push(`${where}: shows ${sha256}, which isn't in files/`)
    }
    const images = content.content.filter(
      (node): node is FileBlockNode => node.type === 'fileBlock',
    )
    for (const image of images) {
      if (!image.attrs.alt) problems.push(`${where}: an image (${image.attrs.fileId}) has no alt`)
    }
  }
  return problems
}
