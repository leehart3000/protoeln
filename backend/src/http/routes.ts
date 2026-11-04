import { Router } from 'express'

import {
  canContribute,
  canEditEntry,
  canManageMembers,
  canRead,
  roleIn,
  type CurrentUser,
  type ProjectAccess,
} from '../access.ts'
import {
  findEntryByCode,
  findNotebook,
  findPeople,
  findProjectByCode,
  findProjectById,
  findUserById,
  listEntries,
  listEntriesIn,
  listNotebooks,
  listNotebooksIn,
  listProjects,
  listProjectsOf,
} from '../data/queries.ts'
import { checkCanRead, userOf } from './context.ts'
import {
  entrySummary,
  entryView,
  notebookRef,
  notebookView,
  projectRef,
  projectView,
} from './views.ts'

// The read-only API: projects, their notebooks and entries. People who can't read a project
// get "not found" rather than "forbidden", so private projects don't reveal they exist.
// Responses show records through the views in views.ts, never as stored.

// What the requester can do in a project
export function accessIn(project: ProjectAccess, user: CurrentUser | null) {
  return {
    yourRole: roleIn(project, user),
    canContribute: canContribute(project, user),
    canManageMembers: canManageMembers(project, user),
  }
}

// The projects the requester can read, and their notebooks, each found by its id
async function readableNotebooks(user: CurrentUser | null) {
  const projects = (await listProjects()).filter((project) => canRead(project, user))
  const notebooks = await listNotebooksIn(projects.map((project) => project._id))
  const projectById = new Map(projects.map((project) => [project._id.toHexString(), project]))
  const projectOf = (notebook: (typeof notebooks)[number]) =>
    projectById.get(notebook.projectId.toHexString())!
  return { notebooks, projectOf }
}

export function readRoutes(options: { orcidBaseUrl?: string } = {}) {
  const orcidBaseUrl = options.orcidBaseUrl ?? 'https://orcid.org'
  const router = Router()

  // The signed-in person, for the header and their profile page: who they are, since when, and
  // their role in each project they're a member of. Their own database id stays inside, like
  // everyone else's.
  router.get('/me', async (_req, res) => {
    const user = userOf(res)
    if (user === null) {
      res.json({ user: null })
      return
    }
    const [record, projects] = await Promise.all([findUserById(user.id), listProjectsOf(user.id)])
    res.json({
      user: {
        name: user.name,
        orcid: user.orcid,
        orcidUrl: `${orcidBaseUrl}/${user.orcid}`,
        siteAdmin: user.siteAdmin,
        since: record?.createdAt ?? null,
        roles: projects.map((project) => ({
          project: projectRef(project),
          role: roleIn(project, user),
        })),
      },
    })
  })

  router.get('/projects', async (_req, res) => {
    const user = userOf(res)
    const projects = await listProjects()
    res.json(
      projects
        .filter((project) => canRead(project, user))
        .map((project) => projectView(project, accessIn(project, user))),
    )
  })

  router.get('/projects/:code', async (req, res) => {
    const user = userOf(res)
    const project = await findProjectByCode(req.params.code)
    checkCanRead(project, user)
    const notebooks = await listNotebooks(project._id)
    const people = await findPeople(notebooks.map((notebook) => notebook.ownerId))
    res.json({
      project: projectView(project, accessIn(project, user)),
      notebooks: notebooks.map((notebook) => notebookView(notebook, people)),
    })
  })

  // Every notebook the requester can read, across projects, most recently changed first
  router.get('/notebooks', async (_req, res) => {
    const { notebooks, projectOf } = await readableNotebooks(userOf(res))
    const people = await findPeople(notebooks.map((notebook) => notebook.ownerId))
    res.json(
      notebooks.map((notebook) => ({
        ...notebookView(notebook, people),
        project: projectRef(projectOf(notebook)),
      })),
    )
  })

  router.get('/notebooks/:id', async (req, res) => {
    const user = userOf(res)
    const notebook = await findNotebook(req.params.id)
    const project = await findProjectById(notebook.projectId)
    checkCanRead(project, user)
    const entries = await listEntries(notebook._id)
    const people = await findPeople([notebook.ownerId, ...entries.map((entry) => entry.authorId)])
    res.json({
      notebook: notebookView(notebook, people),
      project: { ...projectRef(project), canContribute: canContribute(project, user) },
      entries: entries.map((entry) => entrySummary(entry, people)),
    })
  })

  // A summary of every entry the requester can read, across projects, most recently changed first
  router.get('/entries', async (_req, res) => {
    const { notebooks, projectOf } = await readableNotebooks(userOf(res))
    const notebookById = new Map(
      notebooks.map((notebook) => [notebook._id.toHexString(), notebook]),
    )
    const entries = await listEntriesIn(notebooks.map((notebook) => notebook._id))
    const people = await findPeople(entries.map((entry) => entry.authorId))
    res.json(
      entries.map((entry) => {
        const notebook = notebookById.get(entry.notebookId.toHexString())!
        return {
          ...entrySummary(entry, people),
          notebook: notebookRef(notebook),
          project: projectRef(projectOf(notebook)),
        }
      }),
    )
  })

  router.get('/entries/:code', async (req, res) => {
    const entry = await findEntryByCode(req.params.code)
    const notebook = await findNotebook(entry.notebookId.toHexString())
    const project = await findProjectById(notebook.projectId)
    const user = userOf(res)
    checkCanRead(project, user)
    const people = await findPeople([entry.authorId, ...entry.coAuthorIds])
    res.json({
      entry: entryView(entry, people, canEditEntry(entry, project, user)),
      notebook: notebookRef(notebook),
      project: projectRef(project),
    })
  })

  return router
}
