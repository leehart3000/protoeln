import { Router } from 'express'

import { createEntry, createVersion, saveDraft, verifyVersions } from '../data/entries.ts'
import { ENTRY_KINDS } from '../data/models/entry.ts'
import { createNotebook } from '../data/notebooks.ts'
import {
  findEntryByCode,
  findNotebook,
  findProjectByCode,
  findProjectById,
  findVersion,
  listVersions,
} from '../data/queries.ts'
import { BodyReader, checkCanContribute, checkCanRead, requireUser, userOf } from './context.ts'

// Creating notebooks and entries, saving drafts, and creating and checking versions. Each
// write needs someone signed in who is a member of the project; editing an entry is further
// limited to its author and co-authors (checked in data/entries.ts).

async function projectOfEntry(code: string) {
  const entry = await findEntryByCode(code)
  const notebook = await findNotebook(entry.notebookId.toHexString())
  const project = await findProjectById(notebook.projectId)
  return { entry, project }
}

export function writeRoutes() {
  const router = Router()

  router.post('/projects/:code/notebooks', async (req, res) => {
    const user = requireUser(res)
    const project = await findProjectByCode(req.params.code)
    checkCanContribute(project, user)
    const body = new BodyReader(req.body)
    const title = body.text('title')
    const description = body.optionalText('description')
    body.done()

    const notebook = await createNotebook({
      projectId: project._id,
      ownerId: user.id,
      title,
      description,
    })
    res.status(201).json(notebook)
  })

  router.post('/notebooks/:id/entries', async (req, res) => {
    const user = requireUser(res)
    const notebook = await findNotebook(req.params.id)
    checkCanContribute(await findProjectById(notebook.projectId), user)
    const body = new BodyReader(req.body)
    const kind = body.oneOf('kind', ENTRY_KINDS)
    const title = body.text('title')
    const content = body.raw('content')
    body.done()

    const entry = await createEntry({
      notebookId: notebook._id,
      authorId: user.id,
      kind,
      title,
      content,
    })
    res.status(201).json(entry.toObject())
  })

  router.put('/entries/:code/draft', async (req, res) => {
    const user = requireUser(res)
    const { entry, project } = await projectOfEntry(req.params.code)
    checkCanContribute(project, user)
    const body = new BodyReader(req.body)
    const basedOn = body.date('basedOn')
    const title = body.text('title')
    const content = body.raw('content')
    body.done()

    const result = await saveDraft({ entryId: entry._id, userId: user.id, basedOn, title, content })
    res.json({ entry: result.entry.toObject(), changed: result.changed })
  })

  router.post('/entries/:code/versions', async (req, res) => {
    const user = requireUser(res)
    const { entry, project } = await projectOfEntry(req.params.code)
    checkCanContribute(project, user)
    const body = new BodyReader(req.body)
    const note = body.optionalText('note')
    body.done()

    const version = await createVersion({ entryId: entry._id, userId: user.id, note })
    res.status(201).json(version?.toObject())
  })

  router.get('/entries/:code/versions', async (req, res) => {
    const { entry, project } = await projectOfEntry(req.params.code)
    checkCanRead(project, userOf(res))
    res.json(await listVersions(entry._id))
  })

  router.get('/entries/:code/versions/:number', async (req, res) => {
    const { entry, project } = await projectOfEntry(req.params.code)
    checkCanRead(project, userOf(res))
    res.json(await findVersion(entry._id, Number(req.params.number)))
  })

  // Recalculates the hashes of every version, reporting any that have been tampered with
  router.get('/entries/:code/history-check', async (req, res) => {
    const { entry, project } = await projectOfEntry(req.params.code)
    checkCanRead(project, userOf(res))
    const problems = await verifyVersions(entry._id)
    res.json({ intact: problems.length === 0, problems })
  })

  return router
}
