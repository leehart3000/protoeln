import { Router } from 'express'

import { canRead } from '../access.ts'
import {
  findEntryByCode,
  findNotebook,
  findProjectByCode,
  findProjectById,
  listEntries,
  listNotebooks,
  listProjects,
} from '../data/queries.ts'
import { checkCanRead, userOf } from './context.ts'

// The read-only API: projects, their notebooks and entries. People who can't read a project
// get "not found" rather than "forbidden", so private projects don't reveal they exist.

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
