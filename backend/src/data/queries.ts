import mongoose from 'mongoose'
import { stepsOf, type DocNode } from '@protoeln/content'

import { NotFoundError } from '../errors.ts'
import { EntryVersionModel } from './models/entry-version.ts'
import { EntryModel } from './models/entry.ts'
import { NotebookModel } from './models/notebook.ts'
import { ProjectModel } from './models/project.ts'
import { UserModel } from './models/user.ts'

// Read-only lookups for the API. Each returns plain objects (not Mongoose documents), and
// throws NotFoundError if a record doesn't exist, including when an id isn't a valid id at all.

function checkId(id: string, what: string) {
  if (!mongoose.isValidObjectId(id)) {
    throw new NotFoundError(`${what} not found`)
  }
}

export async function findUserById(id: string) {
  if (!mongoose.isValidObjectId(id)) return null
  return UserModel.findById(id).lean()
}

// The names and ORCID iDs of the people with these ids, by id, for showing who did what
export async function findPeople(ids: mongoose.Types.ObjectId[]) {
  const users = await UserModel.find({ _id: { $in: ids } })
    .select('name orcid')
    .lean()
  return new Map(
    users.map((user) => [user._id.toHexString(), { name: user.name, orcid: user.orcid }]),
  )
}

// The names of the people who ticked an entry's protocol steps, by ORCID iD (which is how
// steps record who ticked them)
export async function findPeopleNamedIn(content: DocNode) {
  const orcids = [...new Set(stepsOf(content).flatMap(({ step }) => step.attrs.doneBy ?? []))]
  if (orcids.length === 0) return new Map<string, string>()
  const users = await UserModel.find({ orcid: { $in: orcids } })
    .select('name orcid')
    .lean()
  return new Map(users.map((user) => [String(user.orcid), user.name]))
}

export async function listProjects() {
  return ProjectModel.find().sort({ code: 1 }).lean()
}

// The projects someone is a member of, by code
export async function listProjectsOf(userId: string) {
  return ProjectModel.find({ 'members.userId': userId }).sort({ code: 1 }).lean()
}

export async function findProjectByCode(code: string) {
  const project = await ProjectModel.findOne({ code }).lean()
  if (project === null) throw new NotFoundError('Project not found')
  return project
}

export async function findProjectById(id: mongoose.Types.ObjectId) {
  const project = await ProjectModel.findById(id).lean()
  if (project === null) throw new NotFoundError('Project not found')
  return project
}

export async function listNotebooks(projectId: mongoose.Types.ObjectId) {
  return NotebookModel.find({ projectId }).sort({ title: 1 }).lean()
}

// Every notebook in these projects, most recently changed first
export async function listNotebooksIn(projectIds: mongoose.Types.ObjectId[]) {
  return NotebookModel.find({ projectId: { $in: projectIds } })
    .sort({ updatedAt: -1 })
    .lean()
}

export async function findNotebook(id: string) {
  checkId(id, 'Notebook')
  const notebook = await NotebookModel.findById(id).lean()
  if (notebook === null) throw new NotFoundError('Notebook not found')
  return notebook
}

// A summary of each entry in a notebook, most recently changed first (without content)
export async function listEntries(notebookId: mongoose.Types.ObjectId) {
  return EntryModel.find({ notebookId })
    .select('code kind title status authorId latestVersion updatedAt')
    .sort({ updatedAt: -1 })
    .lean()
}

// A summary of every entry in these notebooks, most recently changed first (without content)
export async function listEntriesIn(notebookIds: mongoose.Types.ObjectId[]) {
  return EntryModel.find({ notebookId: { $in: notebookIds } })
    .select('code kind title status authorId latestVersion updatedAt notebookId')
    .sort({ updatedAt: -1 })
    .lean()
}

export async function findEntryByCode(code: string) {
  const entry = await EntryModel.findOne({ code }).lean()
  if (entry === null) throw new NotFoundError('Entry not found')
  return entry
}

// A summary of each version of an entry, newest first (without content)
export async function listVersions(entryId: mongoose.Types.ObjectId) {
  return EntryVersionModel.find({ entryId })
    .select('number title note createdBy createdAt hash previousHash')
    .sort({ number: -1 })
    .lean()
}

export async function findVersion(entryId: mongoose.Types.ObjectId, number: number) {
  const version = Number.isInteger(number)
    ? await EntryVersionModel.findOne({ entryId, number }).lean()
    : null
  if (version === null) throw new NotFoundError('Version not found')
  return version
}
