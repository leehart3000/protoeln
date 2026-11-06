import type { DocNode } from '@protoeln/content'

// Reading from the API (see docs/api.md). The types match the views in
// backend/src/http/views.ts. Each fetch returns null when the record isn't found (or the
// requester can't read it), so pages can say so, and throws for any other failure.

export interface Person {
  name: string
  orcid: string | null
}

export type ProjectRole = 'admin' | 'contributor' | 'viewer'

export interface Project {
  code: string
  title: string
  description: string
  publicRead: boolean
  // Credit (free text, in which web addresses become links): where the data comes from, how
  // it's licensed and how to cite it
  sourceRepository: string
  licence: string
  citation: string
  links: {
    system: string
    kind: string
    externalId: string | null
    url: string
    label: string | null
  }[]
  yourRole: ProjectRole | null
  canContribute: boolean
  canManageMembers: boolean
  createdAt: string
  updatedAt: string
}

// A project member: named by their ORCID iD until they first sign in
export interface Member {
  name: string
  orcid: string
  orcidUrl: string
  signedIn: boolean
  role: ProjectRole
}

export interface ProjectRef {
  code: string
  title: string
}

export interface Notebook {
  id: string
  title: string
  description: string
  owner: Person
  // On a notebook's own page: whether the visitor can change its title and description
  canEdit?: boolean
  createdAt: string
  updatedAt: string
}

export interface NotebookRef {
  id: string
  title: string
}

export type EntryKind = 'experiment' | 'protocol' | 'note'

export type EntryStatus =
  'draft' | 'in_review' | 'changes_requested' | 'approved' | 'signed' | 'witnessed'

export interface EntrySummary {
  code: string
  kind: EntryKind
  title: string
  status: EntryStatus
  author: Person
  latestVersion: number
  updatedAt: string
}

export interface Entry extends EntrySummary {
  // Whether the requester can change it: its author or a co-author, while it isn't signed
  canEdit: boolean
  coAuthors: Person[]
  contentFormat: string
  content: DocNode
  // The names of the people the content refers to by ORCID iD (who ticked each step)
  contentPeople: Record<string, string>
  text: string
  tags: string[]
  // Where an imported entry came from, crediting its original authors (null if written here)
  source: EntrySource | null
  createdAt: string
}

export interface EntrySource {
  // The record it was imported from, such as a Zenodo record
  url: string
  doi: string
  authors: string[]
  // As YYYY-MM-DD
  publishedOn: string
  licence: string
  citation: string
  // What the import changed, such as converting the format
  changes: string
}

export interface VersionSummary {
  number: number
  title: string
  note: string
  createdBy: Person
  createdAt: string
  previousHash: string | null
  hash: string
}

// In the lists of every notebook and entry, each says where it is
export interface NotebookListItem extends Notebook {
  project: ProjectRef
}

export interface EntryListItem extends EntrySummary {
  notebook: NotebookRef
  project: ProjectRef
}

export interface HistoryCheck {
  intact: boolean
  problems: string[]
}

// The signed-in person (null if no one is), with their role in each project they're in;
// whether the site is read-only (nothing can be changed; see docs/read-only.md); and whether
// it lets anyone read the projects marked public (PROTOELN_PUBLIC_READ)
export interface Me {
  user: {
    name: string
    orcid: string
    orcidUrl: string
    siteAdmin: boolean
    since: string | null
    roles: { project: ProjectRef; role: ProjectRole }[]
  } | null
  readOnly?: boolean
  publicRead?: boolean
}

// A request the API refused, with its reason and, for invalid details, what's wrong with each
// field (by its name, as in { code: 'should be …' })
export class ApiError extends Error {
  readonly status: number
  readonly problems: { path: string; message: string }[]

  constructor(status: number, message: string, problems: { path: string; message: string }[]) {
    super(message)
    this.status = status
    this.problems = problems
  }
}

// What's wrong with each field, from an error from the API (none for any other error)
export function fieldProblems(error: Error | null): Record<string, string> {
  return error instanceof ApiError
    ? Object.fromEntries(error.problems.map((problem) => [problem.path, problem.message]))
    : {}
}

async function sendJson<T>(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(
    path,
    body === undefined
      ? { method }
      : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  )
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) {
    throw new ApiError(
      response.status,
      typeof data.error === 'string' ? data.error : `The API answered ${response.status}`,
      Array.isArray(data.problems) ? (data.problems as ApiError['problems']) : [],
    )
  }
  return data as T
}

function membersPath(projectCode: string, orcid?: string) {
  const base = `/api/v1/projects/${encodeURIComponent(projectCode)}/members`
  return orcid === undefined ? base : `${base}/${encodeURIComponent(orcid)}`
}

export async function fetchMembers(projectCode: string) {
  return (await getJson<Member[]>(membersPath(projectCode))) ?? []
}

// Gives someone a role in the project, changes it, or takes it away (null), answering with the
// members as they now are
export function changeRole(projectCode: string, orcid: string, role: ProjectRole | null) {
  return role === null
    ? sendJson<Member[]>('DELETE', membersPath(projectCode, orcid))
    : sendJson<Member[]>('PUT', membersPath(projectCode, orcid), { role })
}

// The credit for a project's data (see Project)
export interface ProjectCredit {
  sourceRepository: string
  licence: string
  citation: string
}

export function createProject(
  body: { code: string; title: string; description: string; publicRead: boolean } & ProjectCredit,
) {
  return sendJson<Project>('POST', '/api/v1/projects', body)
}

// Changes a project's details: only those given (its code never changes)
export function updateProject(
  code: string,
  changes: Partial<{ title: string; description: string; publicRead: boolean } & ProjectCredit>,
) {
  return sendJson<{ project: Project; changed: boolean }>(
    'PATCH',
    `/api/v1/projects/${encodeURIComponent(code)}`,
    changes,
  )
}

// Changes a notebook's details: only those given
export function updateNotebook(
  id: string,
  changes: Partial<{ title: string; description: string }>,
) {
  return sendJson<{ notebook: Notebook; changed: boolean }>(
    'PATCH',
    `/api/v1/notebooks/${encodeURIComponent(id)}`,
    changes,
  )
}

export function createNotebook(projectCode: string, body: { title: string; description: string }) {
  return sendJson<Notebook>(
    'POST',
    `/api/v1/projects/${encodeURIComponent(projectCode)}/notebooks`,
    body,
  )
}

// Saves an entry's draft. `basedOn` is the updatedAt of the draft being edited: if someone else
// has saved since, the API refuses (409) rather than overwrite their work.
export function saveDraft(
  code: string,
  body: { basedOn: string; title: string; content: DocNode },
) {
  return sendJson<{ entry: Entry; changed: boolean }>(
    'PUT',
    `/api/v1/entries/${encodeURIComponent(code)}/draft`,
    body,
  )
}

// Ticks or unticks the protocol step at `path` in the draft (see stepsOf in @protoeln/content).
// The API records who ticked it and when; like a save, it's refused (409) if the draft has been
// saved since `basedOn`.
export function tickStep(code: string, body: { basedOn: string; path: number[]; done: boolean }) {
  return sendJson<{ entry: Entry; changed: boolean }>(
    'PUT',
    `/api/v1/entries/${encodeURIComponent(code)}/steps`,
    body,
  )
}

// Makes the next numbered, fingerprinted version of the entry's current draft
export function createVersion(code: string, note: string) {
  return sendJson<VersionSummary>('POST', `/api/v1/entries/${encodeURIComponent(code)}/versions`, {
    note,
  })
}

export function createEntry(notebookId: string, body: { kind: EntryKind; title: string }) {
  return sendJson<Entry>(
    'POST',
    `/api/v1/notebooks/${encodeURIComponent(notebookId)}/entries`,
    body,
  )
}

async function getJson<T>(path: string): Promise<T | null> {
  const response = await fetch(path)
  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    throw new Error(`The API answered ${response.status} for ${path}`)
  }
  return (await response.json()) as T
}

export async function fetchMe(): Promise<Me> {
  return (await getJson<Me>('/api/v1/me')) ?? { user: null }
}

// Where "Sign in" goes: the API's ORCID sign-in, which comes back to `returnTo` (a path here)
export function signInHref(returnTo: string) {
  return `/api/v1/auth/orcid/login?returnTo=${encodeURIComponent(returnTo)}`
}

export async function signOut() {
  const response = await fetch('/api/v1/auth/logout', { method: 'POST' })
  if (!response.ok) {
    throw new Error(`The API answered ${response.status} when signing out`)
  }
}

export async function fetchProjects() {
  return (await getJson<Project[]>('/api/v1/projects')) ?? []
}

export function fetchProject(code: string) {
  return getJson<{ project: Project; notebooks: Notebook[] }>(
    `/api/v1/projects/${encodeURIComponent(code)}`,
  )
}

export async function fetchAllNotebooks() {
  return (await getJson<NotebookListItem[]>('/api/v1/notebooks')) ?? []
}

export async function fetchAllEntries() {
  return (await getJson<EntryListItem[]>('/api/v1/entries')) ?? []
}

export function fetchNotebook(id: string) {
  return getJson<{
    notebook: Notebook
    project: ProjectRef & { canContribute: boolean }
    entries: EntrySummary[]
  }>(`/api/v1/notebooks/${encodeURIComponent(id)}`)
}

export function fetchEntry(code: string) {
  return getJson<{ entry: Entry; notebook: NotebookRef; project: ProjectRef }>(
    `/api/v1/entries/${encodeURIComponent(code)}`,
  )
}

// An entry that links to another, saying where the link is: in its current draft, and in which
// of its versions
export interface LinkingEntry extends EntryListItem {
  linkedIn: { draft: boolean; versions: number[] }
}

// The entries the requester can read that link to this one
export async function fetchLinkedFrom(code: string) {
  const path = `/api/v1/entries/${encodeURIComponent(code)}/linked-from`
  return (await getJson<LinkingEntry[]>(path)) ?? []
}

// One version in full, as it was made
export interface Version extends VersionSummary {
  contentFormat: string
  content: DocNode
  contentPeople: Record<string, string>
  text: string
  markdown: string
}

export function fetchVersion(code: string, number: number) {
  return getJson<Version>(`/api/v1/entries/${encodeURIComponent(code)}/versions/${number}`)
}

export function fetchVersions(code: string) {
  return getJson<VersionSummary[]>(`/api/v1/entries/${encodeURIComponent(code)}/versions`)
}

export function fetchHistoryCheck(code: string) {
  return getJson<HistoryCheck>(`/api/v1/entries/${encodeURIComponent(code)}/history-check`)
}
