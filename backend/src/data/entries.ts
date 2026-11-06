import mongoose from 'mongoose'
import {
  CONTENT_FORMAT,
  checkDocument,
  linkedEntryCodes,
  pathText,
  stepsOf,
  toMarkdown,
  toPlainText,
  type DocNode,
  type ProtocolStepNode,
} from '@protoeln/content'

import { isLocked } from '../access.ts'
import { ConflictError, ForbiddenError, InvalidError, NotFoundError } from '../errors.ts'
import { diffJson } from '../integrity/json-patch.ts'
import { versionHash } from '../integrity/version-hash.ts'
import { nextEntryCode } from './models/counter.ts'
import { EntryChangeModel } from './models/entry-change.ts'
import { EntryVersionModel } from './models/entry-version.ts'
import { EntryModel, ENTRY_KINDS } from './models/entry.ts'

// What can be done to an entry: create it, save its draft, tick off its protocol steps, and
// create versions of it. Each operation that writes more than one record does so in a
// transaction, so that either all of its records are saved or none are: a save is never
// recorded without its change, nor a version without the entry knowing about it.

type Id = mongoose.Types.ObjectId | string

function checkContent(content: unknown): DocNode {
  const problems = checkDocument(content)
  if (problems.length > 0) {
    throw new InvalidError('The entry content is not valid', problems)
  }
  return content as DocNode
}

// A step's tick (whether it's done, who ticked it and when), for comparing ticks
function tickOf(step: ProtocolStepNode) {
  const { done, doneBy, doneAt } = step.attrs
  return JSON.stringify([done === true, doneBy ?? null, doneAt ?? null])
}
const UNTICKED = tickOf({ type: 'protocolStep', attrs: { done: false } })

// Steps are ticked and unticked with tickStep, which records who and when from the server, so
// that a tick can be trusted. Content saved any other way may keep the ticks it already has
// (moving, copying or deleting steps), but can't add or change one.
function checkTicksKept(before: DocNode, after: DocNode) {
  const kept = new Map<string, number>()
  for (const { step } of stepsOf(before)) {
    kept.set(tickOf(step), (kept.get(tickOf(step)) ?? 0) + 1)
  }
  const problems: { path: string; message: string }[] = []
  for (const { path, step } of stepsOf(after)) {
    const tick = tickOf(step)
    if (tick === UNTICKED) continue
    const left = kept.get(tick) ?? 0
    if (left === 0) {
      problems.push({
        path: `${pathText(path)}.attrs`,
        message: 'should be as saved: steps are ticked and unticked on the entry page',
      })
    } else {
      kept.set(tick, left - 1)
    }
  }
  if (problems.length > 0) {
    throw new InvalidError('The entry content is not valid', problems)
  }
}

const EMPTY_DOC: DocNode = { type: 'doc', content: [] }

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
  if (isLocked(entry.status)) {
    throw new ConflictError('This entry is signed, so it can no longer be changed; add an addendum')
  }
}

export async function createEntry(input: {
  notebookId: Id
  authorId: Id
  kind: (typeof ENTRY_KINDS)[number]
  title: string
  content?: unknown
  tags?: string[]
  // For an imported entry (see models/entry.ts)
  source?: EntrySource
}) {
  const content = checkContent(input.content ?? EMPTY_DOC)
  checkTicksKept(EMPTY_DOC, content)
  return EntryModel.create({
    code: await nextEntryCode(),
    notebookId: input.notebookId,
    authorId: input.authorId,
    kind: input.kind,
    title: input.title,
    content,
    text: toPlainText(content),
    linkedEntries: linkedEntryCodes(content),
    tags: input.tags ?? [],
    source: input.source ?? null,
  })
}

// Where an imported entry came from, crediting its original authors
export interface EntrySource {
  url: string
  doi: string
  authors: string[]
  publishedOn: string
  licence: string
  citation: string
}

type EntryDocument = Awaited<ReturnType<typeof findEntry>>

// Finds an entry to change, checking that this person may change it and that the draft they
// changed is the one saved: `basedOn` is when that draft was last saved (the entry's updatedAt
// as they loaded it). If someone else has saved since, the change is refused rather than
// silently overwriting their work.
async function entryToChange(
  input: { entryId: Id; userId: Id; basedOn: Date },
  session: mongoose.ClientSession,
) {
  const entry = await findEntry(input.entryId, session)
  checkCanEdit(entry, input.userId)
  if (entry.updatedAt.getTime() !== input.basedOn.getTime()) {
    throw new ConflictError('This entry has been saved by someone else since you opened it')
  }
  return entry
}

// Saves a new title and content as the entry's draft, recording exactly what changed (if
// anything did)
async function storeDraft(
  entry: EntryDocument,
  change: { userId: Id; title: string; content: DocNode },
  session: mongoose.ClientSession,
) {
  const before = { title: entry.title, content: entry.content as unknown }
  const after = { title: change.title, content: change.content as unknown }
  const diff = diffJson(before, after)
  if (diff.length === 0) {
    return { entry, changed: false }
  }

  entry.title = change.title
  entry.content = change.content
  entry.markModified('content')
  entry.text = toPlainText(change.content)
  entry.linkedEntries = linkedEntryCodes(change.content)
  await entry.save({ session })
  await EntryChangeModel.create([{ entryId: entry._id, userId: change.userId, diff }], {
    session,
  })
  return { entry, changed: true }
}

// Saves an entry's draft and records what changed
export async function saveDraft(input: {
  entryId: Id
  userId: Id
  basedOn: Date
  title: string
  content: unknown
}) {
  const content = checkContent(input.content)

  return mongoose.connection.transaction(async (session) => {
    const entry = await entryToChange(input, session)
    checkTicksKept(entry.content as DocNode, content)
    return storeDraft(entry, { userId: input.userId, title: input.title, content }, session)
  })
}

// Ticks (or unticks) the protocol step at `path` in the draft (see stepsOf), recording who
// ticked it (by ORCID iD) and when, from the server's clock. Unticking removes both; the
// change, like any other, is kept in the entry's history.
export async function tickStep(input: {
  entryId: Id
  user: { id: Id; orcid: string }
  basedOn: Date
  path: number[]
  done: boolean
}) {
  return mongoose.connection.transaction(async (session) => {
    const entry = await entryToChange({ ...input, userId: input.user.id }, session)
    const content = JSON.parse(JSON.stringify(entry.content)) as DocNode
    const found = stepsOf(content).find(
      ({ path }) => path.length === input.path.length && path.every((i, n) => i === input.path[n]),
    )
    if (found === undefined) {
      throw new InvalidError('The request has problems', [
        { path: 'path', message: 'should be where a protocol step is in the draft' },
      ])
    }
    if (found.step.attrs.done === input.done) {
      return { entry, changed: false }
    }
    found.step.attrs = input.done
      ? { done: true, doneBy: input.user.orcid, doneAt: new Date().toISOString() }
      : { done: false }
    return storeDraft(entry, { userId: input.user.id, title: entry.title, content }, session)
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
          linkedEntries: linkedEntryCodes(content),
          note,
          createdBy: input.userId,
          createdAt,
          previousHash,
          hash,
        },
      ],
      { session },
    )
    // A version doesn't change the draft, so the entry's updatedAt (when its draft was last
    // saved, which a save's basedOn is checked against) stays as it was. Otherwise saving again
    // straight after creating a version would be refused, as if someone else had saved.
    entry.latestVersion = number
    await entry.save({ session, timestamps: false })
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
