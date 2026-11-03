import { Router, type Response } from 'express'

import { canRead, type CurrentUser, type ProjectAccess } from '../access.ts'
import {
  findEntryByCode,
  findNotebook,
  findProjectByCode,
  findProjectById,
  listEntries,
  listNotebooks,
  listProjects,
} from '../data/queries.ts'
import { NotFoundError } from '../errors.ts'

// The read-only API: projects, their notebooks and entries. People who can't read a project
// get "not found" rather than "forbidden", so private projects don't reveal they exist.

// Who made the request, as worked out by the app's authenticate option (see app.ts)
function userOf(res: Response): CurrentUser | null {
  return (res.locals.user as CurrentUser | null | undefined) ?? null
}

function checkCanRead(project: ProjectAccess, user: CurrentUser | null) {
  if (!canRead(project, user)) {
    throw new NotFoundError('Project not found')
  }
}

export function readRoutes() {
  const router = Router()

  router.get('/me', (_req, res) => {
    res.json({ user: userOf(res) })
  })

  router.get('/projects', async (req, res) => {
    const user = userOf(res)
    const projects = await listProjects()
    res.json(projects.filter((project) => canRead(project, user)))
  })

  router.get('/projects/:code', async (req, res) => {
    const project = await findProjectByCode(req.params.code)
    checkCanRead(project, userOf(res))
    res.json({ project, notebooks: await listNotebooks(project._id) })
  })

  router.get('/notebooks/:id', async (req, res) => {
    const notebook = await findNotebook(req.params.id)
    const project = await findProjectById(notebook.projectId)
    checkCanRead(project, userOf(res))
    res.json({
      notebook,
      project: { _id: project._id, code: project.code, title: project.title },
      entries: await listEntries(notebook._id),
    })
  })

  router.get('/entries/:code', async (req, res) => {
    const entry = await findEntryByCode(req.params.code)
    const notebook = await findNotebook(entry.notebookId.toHexString())
    const project = await findProjectById(notebook.projectId)
    checkCanRead(project, userOf(res))
    res.json({
      entry,
      notebook: { _id: notebook._id, title: notebook.title },
      project: { _id: project._id, code: project.code, title: project.title },
    })
  })

  return router
}
