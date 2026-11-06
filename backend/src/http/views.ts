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
  // (Missing from projects created before they were added)
  sourceRepository?: string
  licence?: string
  citation?: string
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

// What the requester can do in a project, so pages know what to offer: their role (null if
// they aren't a member), whether they can add notebooks and entries, and whether they can
// choose its members
export interface ProjectAccessView {
  yourRole: ProjectRole | null
  canContribute: boolean
  canManageMembers: boolean
}

export function projectView(project: ProjectRecord, access: ProjectAccessView) {
  return {
    code: project.code,
    title: project.title,
    description: project.description,
    publicRead: project.publicRead,
    sourceRepository: project.sourceRepository ?? '',
    licence: project.licence ?? '',
    citation: project.citation ?? '',
    links: project.links.map((link) => ({
      system: link.system,
      kind: link.kind,
      externalId: link.externalId ?? null,
      url: link.url,
      label: link.label ?? null,
    })),
    ...access,
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
  source?: {
    url: string
    doi?: string | null
    authors?: string[] | null
    publishedOn?: string | null
    licence?: string | null
    citation?: string | null
  } | null
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
// `canEdit` is whether the requester can change it (see canEditEntry in access.ts)
// `named` gives the names of people the content refers to by ORCID iD (who ticked each
// protocol step; see findPeopleNamedIn in data/queries.ts)
export function entryView(
  entry: EntryRecord,
  people: People,
  canEdit: boolean,
  named: Map<string, string> = new Map(),
) {
  return {
    ...entrySummary(entry, people),
    canEdit,
    coAuthors: entry.coAuthorIds.map((id) => person(people, id)),
    contentFormat: entry.contentFormat,
    content: entry.content,
    contentPeople: Object.fromEntries(named),
    // Where an imported entry came from (null for entries written here)
    source: entry.source
      ? {
          url: entry.source.url,
          doi: entry.source.doi ?? '',
          authors: entry.source.authors ?? [],
          publishedOn: entry.source.publishedOn ?? '',
          licence: entry.source.licence ?? '',
          citation: entry.source.citation ?? '',
        }
      : null,
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

// `named` gives the names of the people the content refers to by ORCID iD, as for an entry
export function versionView(
  version: VersionRecord,
  people: People,
  named: Map<string, string> = new Map(),
) {
  return {
    ...versionSummary(version, people),
    contentFormat: version.contentFormat,
    content: version.content,
    contentPeople: Object.fromEntries(named),
    text: version.text,
    markdown: version.markdown,
  }
}

// Project members, by name and ORCID iD, with whether they've signed in yet (someone can be
// added before they first sign in)
export function memberView(
  member: { name: string; orcid: string; signedIn: boolean; role: ProjectRole },
  orcidBaseUrl: string,
) {
  return { ...member, orcidUrl: `${orcidBaseUrl}/${member.orcid}` }
}
