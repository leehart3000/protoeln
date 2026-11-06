import { Router } from 'express'

import { canEditNotebook, canEditProject } from '../access.ts'
import { updateNotebook } from '../data/notebooks.ts'
import { updateProject } from '../data/projects.ts'
import { findNotebook, findPeople, findProjectByCode, findProjectById } from '../data/queries.ts'
import { ForbiddenError } from '../errors.ts'
import { BodyReader, checkCanRead, requireUser } from './context.ts'
import { accessIn } from './routes.ts'
import { notebookView, projectView } from './views.ts'

// Changing a project's or notebook's details after it's created (for a project, also its
// credit: where its data comes from, its licence and how to cite it), as ProtoLIMS's edit pages do.
// Only the details sent change, so two people changing different details don't undo each
// other's changes; a project's code never changes. Each change is recorded with who made it
// and when (see data/details.ts). Answers with the record as it now is.

export function detailRoutes() {
  const router = Router()

  // For the project's admins and site admins
  router.patch('/projects/:code', async (req, res) => {
    const user = requireUser(res)
    const project = await findProjectByCode(req.params.code)
    checkCanRead(res, project)
    if (!canEditProject(project, user)) {
      throw new ForbiddenError("Only the project's admins can change its details")
    }
    const body = new BodyReader(req.body)
    const title = body.optionalNonEmptyText('title')
    const description = body.optionalText('description')
    const publicRead = body.optionalFlag('publicRead')
    const sourceRepository = body.optionalText('sourceRepository')
    const licence = body.optionalText('licence')
    const citation = body.optionalText('citation')
    body.done()

    const result = await updateProject({
      projectId: project._id,
      userId: user.id,
      changes: { title, description, publicRead, sourceRepository, licence, citation },
    })
    res.json({
      project: projectView(result.project, accessIn(result.project, user)),
      changed: result.changed,
    })
  })

  // For the notebook's owner (while they can contribute to its project), the project's admins
  // and site admins
  router.patch('/notebooks/:id', async (req, res) => {
    const user = requireUser(res)
    const notebook = await findNotebook(req.params.id)
    const project = await findProjectById(notebook.projectId)
    checkCanRead(res, project)
    if (!canEditNotebook(notebook, project, user)) {
      throw new ForbiddenError("Only the notebook's owner and the project's admins can change it")
    }
    const body = new BodyReader(req.body)
    const title = body.optionalNonEmptyText('title')
    const description = body.optionalText('description')
    body.done()

    const result = await updateNotebook({
      notebookId: notebook._id,
      userId: user.id,
      changes: { title, description },
    })
    const people = await findPeople([result.notebook.ownerId])
    res.json({
      notebook: { ...notebookView(result.notebook, people), canEdit: true },
      changed: result.changed,
    })
  })

  return router
}
