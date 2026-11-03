import { Router } from 'express'

import { canRead, roleIn } from '../access.ts'
import {
  findEntryByCode,
  findNotebook,
  findPeople,
  findProjectByCode,
  findProjectById,
  listEntries,
  listNotebooks,
  listProjects,
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

export function readRoutes() {
  const router = Router()

  // The signed-in person (their own database id stays inside, like everyone else's)
  router.get('/me', (_req, res) => {
    const user = userOf(res)
    res.json({
      user: user && { name: user.name, orcid: user.orcid, siteAdmin: user.siteAdmin },
    })
  })

  router.get('/projects', async (_req, res) => {
    const user = userOf(res)
    const projects = await listProjects()
    res.json(
      projects
        .filter((project) => canRead(project, user))
        .map((project) => projectView(project, roleIn(project, user))),
    )
  })

  router.get('/projects/:code', async (req, res) => {
    const user = userOf(res)
    const project = await findProjectByCode(req.params.code)
    checkCanRead(project, user)
    const notebooks = await listNotebooks(project._id)
    const people = await findPeople(notebooks.map((notebook) => notebook.ownerId))
    res.json({
      project: projectView(project, roleIn(project, user)),
      notebooks: notebooks.map((notebook) => notebookView(notebook, people)),
    })
  })

  router.get('/notebooks/:id', async (req, res) => {
    const notebook = await findNotebook(req.params.id)
    const project = await findProjectById(notebook.projectId)
    checkCanRead(project, userOf(res))
    const entries = await listEntries(notebook._id)
    const people = await findPeople([notebook.ownerId, ...entries.map((entry) => entry.authorId)])
    res.json({
      notebook: notebookView(notebook, people),
      project: projectRef(project),
      entries: entries.map((entry) => entrySummary(entry, people)),
    })
  })

  router.get('/entries/:code', async (req, res) => {
    const entry = await findEntryByCode(req.params.code)
    const notebook = await findNotebook(entry.notebookId.toHexString())
    const project = await findProjectById(notebook.projectId)
    checkCanRead(project, userOf(res))
    const people = await findPeople([entry.authorId, ...entry.coAuthorIds])
    res.json({
      entry: entryView(entry, people),
      notebook: notebookRef(notebook),
      project: projectRef(project),
    })
  })

  return router
}
