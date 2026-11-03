import mongoose from 'mongoose'
import {
  CONTENT_FORMAT,
  checkDocument,
  toMarkdown,
  toPlainText,
  type DocNode,
} from '@protoeln/content'

import { ConflictError, ForbiddenError, InvalidError, NotFoundError } from '../errors.ts'
import { diffJson } from '../integrity/json-patch.ts'
import { versionHash } from '../integrity/version-hash.ts'
import { nextEntryCode } from './models/counter.ts'
import { EntryChangeModel } from './models/entry-change.ts'
import { EntryVersionModel } from './models/entry-version.ts'
import { EntryModel, ENTRY_KINDS } from './models/entry.ts'

// What can be done to an entry: create it, save its draft, and create versions of it. Each
// operation that writes more than one record does so in a transaction, so that either all of
// its records are saved or none are: a save is never recorded without its change, nor a
// version without the entry knowing about it.

type Id = mongoose.Types.ObjectId | string

// Signed and witnessed entries are locked: corrections are made with an addendum
const LOCKED_STATUSES = new Set(['signed', 'witnessed'])

function checkContent(content: unknown): DocNode {
  const problems = checkDocument(content)
  if (problems.length > 0) {
    throw new InvalidError('The entry content is not valid', problems)
  }
  return content as DocNode
}

async function findEntry(entryId: Id, session?: mongoose.ClientSession) {
  const entry = await EntryModel.findById(entryId).session(session ?? null)
  if (entry === null) {
    throw new NotFoundError('Entry not found')
  }
  return entry
}

interface Editable {
  authorId: mongoose.Types.ObjectId
  coAuthorIds: mongoose.Types.ObjectId[]
  status: string
}

function checkCanEdit(entry: Editable, userId: Id) {
  const editors = [entry.authorId, ...entry.coAuthorIds].map(String)
  if (!editors.includes(String(userId))) {
    throw new ForbiddenError('Only the author and co-authors can change this entry')
  }
  if (LOCKED_STATUSES.has(entry.status)) {
    throw new ConflictError('This entry is signed, so it can no longer be changed; add an addendum')
  }
}

export async function createEntry(input: {
  notebookId: Id
  authorId: Id
  kind: (typeof ENTRY_KINDS)[number]
  title: string
  content?: unknown
}) {
  const content = checkContent(input.content ?? { type: 'doc', content: [] })
  return EntryModel.create({
    code: await nextEntryCode(),
    notebookId: input.notebookId,
    authorId: input.authorId,
    kind: input.kind,
    title: input.title,
    content,
    text: toPlainText(content),
  })
}

// Saves an entry's draft and records what changed. `basedOn` is when the draft being edited was
// last saved (the entry's updatedAt as the editor loaded it); if someone else has saved since,
// the save is refused rather than silently overwriting their work.
export async function saveDraft(input: {
  entryId: Id
  userId: Id
  basedOn: Date
  title: string
  content: unknown
}) {
  const content = checkContent(input.content)

  return mongoose.connection.transaction(async (session) => {
    const entry = await findEntry(input.entryId, session)
    checkCanEdit(entry, input.userId)
    if (entry.updatedAt.getTime() !== input.basedOn.getTime()) {
      throw new ConflictError('This entry has been saved by someone else since you opened it')
    }

    const before = { title: entry.title, content: entry.content as unknown }
    const after = { title: input.title, content: content as unknown }
    const diff = diffJson(before, after)
    if (diff.length === 0) {
      return { entry, changed: false }
    }

    entry.title = input.title
    entry.content = content
    entry.markModified('content')
    entry.text = toPlainText(content)
    await entry.save({ session })
    await EntryChangeModel.create([{ entryId: entry._id, userId: input.userId, diff }], {
      session,
    })
    return { entry, changed: true }
  })
}

// Makes a full, numbered, hash-chained snapshot of the entry's current draft
export async function createVersion(input: { entryId: Id; userId: Id; note?: string }) {
  return mongoose.connection.transaction(async (session) => {
    const entry = await findEntry(input.entryId, session)
    checkCanEdit(entry, input.userId)

    const previous =
      entry.latestVersion === 0
        ? null
        : await EntryVersionModel.findOne({ entryId: entry._id, number: entry.latestVersion })
            .session(session)
            .lean()
    const number = entry.latestVersion + 1
    const content = entry.content as DocNode
    const createdAt = new Date()
    const note = input.note ?? ''
    const previousHash = previous?.hash ?? null
    const hash = versionHash({
      entryId: entry._id.toHexString(),
      number,
      title: entry.title,
      contentFormat: entry.contentFormat,
      content,
      note,
      createdBy: String(input.userId),
      createdAt: createdAt.toISOString(),
      previousHash,
    })

    const [version] = await EntryVersionModel.create(
      [
        {
          entryId: entry._id,
          number,
          title: entry.title,
          contentFormat: CONTENT_FORMAT,
          content,
          text: toPlainText(content),
          markdown: toMarkdown(content),
          note,
          createdBy: input.userId,
          createdAt,
          previousHash,
          hash,
        },
      ],
      { session },
    )
    entry.latestVersion = number
    await entry.save({ session })
    return version
  })
}

// Recalculates every version's hash and checks each is chained to the one before. Returns the
// problems found (none if the history is intact).
export async function verifyVersions(entryId: Id): Promise<string[]> {
  const versions = await EntryVersionModel.find({ entryId }).sort({ number: 1 }).lean()
  const problems: string[] = []
  let previousHash: string | null = null
  versions.forEach((version, index) => {
    if (version.number !== index + 1) {
      problems.push(`Version ${index + 1} is missing`)
    }
    if (version.previousHash !== previousHash) {
      problems.push(`Version ${version.number} is not chained to the version before it`)
    }
    const expected = versionHash({
      entryId: version.entryId.toHexString(),
      number: version.number,
      title: version.title,
      contentFormat: version.contentFormat,
      content: version.content,
      note: version.note,
      createdBy: version.createdBy.toHexString(),
      createdAt: version.createdAt.toISOString(),
      previousHash: version.previousHash ?? null,
    })
    if (version.hash !== expected) {
      problems.push(`Version ${version.number} has been changed since it was created`)
    }
    previousHash = version.hash
  })
  return problems
}
