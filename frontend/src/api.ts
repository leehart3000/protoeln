import type { DocNode } from '@protoeln/content'

// Reading from the API (see docs/api.md). The types match the views in
// backend/src/http/views.ts. Each fetch returns null when the record isn't found (or the
// requester can't read it), so pages can say so, and throws for any other failure.

export interface Person {
  name: string
  orcid: string | null
}

export type ProjectRole = 'admin' | 'member' | 'viewer'

export interface Project {
  code: string
  title: string
  description: string
  publicRead: boolean
  links: {
    system: string
    kind: string
    externalId: string | null
    url: string
    label: string | null
  }[]
  yourRole: ProjectRole | null
  createdAt: string
  updatedAt: string
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
  coAuthors: Person[]
  contentFormat: string
  content: DocNode
  text: string
  tags: string[]
  createdAt: string
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

// The signed-in person (null if no one is), with their role in each project they're in
export interface Me {
  user: {
    name: string
    orcid: string
    orcidUrl: string
    siteAdmin: boolean
    since: string | null
    roles: { project: ProjectRef; role: ProjectRole }[]
  } | null
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
  return getJson<{ notebook: Notebook; project: ProjectRef; entries: EntrySummary[] }>(
    `/api/v1/notebooks/${encodeURIComponent(id)}`,
  )
}

export function fetchEntry(code: string) {
  return getJson<{ entry: Entry; notebook: NotebookRef; project: ProjectRef }>(
    `/api/v1/entries/${encodeURIComponent(code)}`,
  )
}

export function fetchVersions(code: string) {
  return getJson<VersionSummary[]>(`/api/v1/entries/${encodeURIComponent(code)}/versions`)
}

export function fetchHistoryCheck(code: string) {
  return getJson<HistoryCheck>(`/api/v1/entries/${encodeURIComponent(code)}/history-check`)
}
