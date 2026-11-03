import type { ProjectRole } from '../access.ts'

// What the API shows of each record. Records are never sent as stored: each view lists the
// fields it shows, so internal details (database ids of people, Mongoose's __v, who added a
// link) stay inside, and a field added to a model is only shown once a view includes it.
// People are shown by name and ORCID iD, which are public, rather than by database id.

interface Id {
  toHexString(): string
}

export interface Person {
  name: string
  orcid: string | null
}

// The people a response mentions, by database id (see findPeople in data/queries.ts)
export type People = Map<string, Person>

const UNKNOWN_PERSON: Person = { name: 'Unknown person', orcid: null }

function person(people: People, id: Id): Person {
  return people.get(id.toHexString()) ?? UNKNOWN_PERSON
}

// Projects

interface ProjectRecord {
  code: string
  title: string
  description: string
  publicRead: boolean
  links: {
    system: string
    kind: string
    externalId?: string | null
    url: string
    label?: string | null
  }[]
  createdAt: Date
  updatedAt: Date
}

export function projectRef(project: { code: string; title: string }) {
  return { code: project.code, title: project.title }
}

// `yourRole` is the requester's role in the project, or null if they aren't a member
export function projectView(project: ProjectRecord, yourRole: ProjectRole | null) {
  return {
    code: project.code,
    title: project.title,
    description: project.description,
    publicRead: project.publicRead,
    links: project.links.map((link) => ({
      system: link.system,
      kind: link.kind,
      externalId: link.externalId ?? null,
      url: link.url,
      label: link.label ?? null,
    })),
    yourRole,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }
}

// Notebooks have no code of their own, so their id is shown and used in addresses

interface NotebookRecord {
  _id: Id
  title: string
  description: string
  ownerId: Id
  createdAt: Date
  updatedAt: Date
}

export function notebookRef(notebook: { _id: Id; title: string }) {
  return { id: notebook._id.toHexString(), title: notebook.title }
}

export function notebookView(notebook: NotebookRecord, people: People) {
  return {
    id: notebook._id.toHexString(),
    title: notebook.title,
    description: notebook.description,
    owner: person(people, notebook.ownerId),
    createdAt: notebook.createdAt,
    updatedAt: notebook.updatedAt,
  }
}

// Entries

interface EntrySummaryRecord {
  code: string
  kind: string
  title: string
  status: string
  authorId: Id
  latestVersion: number
  updatedAt: Date
}

interface EntryRecord extends EntrySummaryRecord {
  coAuthorIds: Id[]
  contentFormat: string
  content: unknown
  text: string
  tags: string[]
  entities: unknown[]
  createdAt: Date
}

export function entrySummary(entry: EntrySummaryRecord, people: People) {
  return {
    code: entry.code,
    kind: entry.kind,
    title: entry.title,
    status: entry.status,
    author: person(people, entry.authorId),
    latestVersion: entry.latestVersion,
    updatedAt: entry.updatedAt,
  }
}

// `updatedAt` is also what a save sends back as `basedOn`
export function entryView(entry: EntryRecord, people: People) {
  return {
    ...entrySummary(entry, people),
    coAuthors: entry.coAuthorIds.map((id) => person(people, id)),
    contentFormat: entry.contentFormat,
    content: entry.content,
    text: entry.text,
    tags: entry.tags,
    entities: entry.entities,
    createdAt: entry.createdAt,
  }
}

// Versions

interface VersionSummaryRecord {
  number: number
  title: string
  note: string
  createdBy: Id
  createdAt: Date
  previousHash?: string | null
  hash: string
}

interface VersionRecord extends VersionSummaryRecord {
  contentFormat: string
  content: unknown
  text: string
  markdown: string
}

export function versionSummary(version: VersionSummaryRecord, people: People) {
  return {
    number: version.number,
    title: version.title,
    note: version.note,
    createdBy: person(people, version.createdBy),
    createdAt: version.createdAt,
    previousHash: version.previousHash ?? null,
    hash: version.hash,
  }
}

export function versionView(version: VersionRecord, people: People) {
  return {
    ...versionSummary(version, people),
    contentFormat: version.contentFormat,
    content: version.content,
    text: version.text,
    markdown: version.markdown,
  }
}
