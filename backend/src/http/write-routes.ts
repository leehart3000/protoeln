import { Router } from 'express'
import type { DocNode } from '@protoeln/content'

import { createEntry, createVersion, saveDraft, tickStep, verifyVersions } from '../data/entries.ts'
import { fileInfoFor } from '../data/files.ts'
import { ENTRY_KINDS } from '../data/models/entry.ts'
import { PROJECT_CODE } from '../data/models/project.ts'
import { createNotebook } from '../data/notebooks.ts'
import { createProject } from '../data/projects.ts'
import { ForbiddenError } from '../errors.ts'
import {
  findEntryByCode,
  findNotebook,
  findPeople,
  findPeopleNamedIn,
  findProjectByCode,
  findProjectById,
  findVersion,
  listVersions,
} from '../data/queries.ts'
import { BodyReader, checkCanContribute, checkCanRead, requireUser } from './context.ts'
import { entryView, notebookView, projectView, versionSummary, versionView } from './views.ts'

// Creating notebooks and entries, saving drafts, ticking protocol steps, and creating and
// checking versions. Each write needs someone signed in who is a member of the project; editing
// an entry (including ticking its steps) is further limited to its author and co-authors
// (checked in data/entries.ts). Responses show records through the views in views.ts, never as
// stored.

async function projectOfEntry(code: string) {
  const entry = await findEntryByCode(code)
  const notebook = await findNotebook(entry.notebookId.toHexString())
  const project = await findProjectById(notebook.projectId)
  return { entry, project }
}

// An entry as the API shows it to its author, just after they changed it
async function savedEntryView(entry: Awaited<ReturnType<typeof saveDraft>>['entry']) {
  const saved = entry.toObject()
  const people = await findPeople([saved.authorId, ...saved.coAuthorIds])
  const named = await findPeopleNamedIn(saved.content as DocNode)
  return entryView(saved, people, true, named, await fileInfoFor(saved.files))
}

export function writeRoutes() {
  const router = Router()

  // Only site admins create projects (as in ProtoLIMS); the creator becomes the project's admin
  router.post('/projects', async (req, res) => {
    const user = requireUser(res)
    if (!user.siteAdmin) {
      throw new ForbiddenError('Only site admins can create projects')
    }
    const body = new BodyReader(req.body)
    const code = body.matching(
      'code',
      PROJECT_CODE,
      'should be 2 to 10 capital letters and digits, starting with a letter',
    )
    const title = body.text('title')
    const description = body.optionalText('description')
    const publicRead = body.optionalBoolean('publicRead', false)
    const sourceRepository = body.optionalText('sourceRepository')
    const licence = body.optionalText('licence')
    const citation = body.optionalText('citation')
    body.done()

    const project = await createProject({
      code,
      title,
      description,
      publicRead,
      sourceRepository,
      licence,
      citation,
      creatorId: user.id,
    })
    res
      .status(201)
      .json(
        projectView(project, { yourRole: 'admin', canContribute: true, canManageMembers: true }),
      )
  })

  router.post('/projects/:code/notebooks', async (req, res) => {
    const user = requireUser(res)
    const project = await findProjectByCode(req.params.code)
    checkCanContribute(res, project)
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
    res.status(201).json(notebookView(notebook, await findPeople([notebook.ownerId])))
  })

  router.post('/notebooks/:id/entries', async (req, res) => {
    const user = requireUser(res)
    const notebook = await findNotebook(req.params.id)
    checkCanContribute(res, await findProjectById(notebook.projectId))
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
    res.status(201).json(entryView(entry.toObject(), await findPeople([entry.authorId]), true))
  })

  router.put('/entries/:code/draft', async (req, res) => {
    const user = requireUser(res)
    const { entry, project } = await projectOfEntry(req.params.code)
    checkCanContribute(res, project)
    const body = new BodyReader(req.body)
    const basedOn = body.date('basedOn')
    const title = body.text('title')
    const content = body.raw('content')
    body.done()

    const result = await saveDraft({ entryId: entry._id, userId: user.id, basedOn, title, content })
    res.json({ entry: await savedEntryView(result.entry), changed: result.changed })
  })

  // Ticks or unticks a protocol step in the draft, found by its path (see stepsOf in
  // @protoeln/content); the server records who ticked it and when
  router.put('/entries/:code/steps', async (req, res) => {
    const user = requireUser(res)
    const { entry, project } = await projectOfEntry(req.params.code)
    checkCanContribute(res, project)
    const body = new BodyReader(req.body)
    const basedOn = body.date('basedOn')
    const path = body.indexPath('path')
    const done = body.boolean('done')
    body.done()

    const result = await tickStep({ entryId: entry._id, user, basedOn, path, done })
    res.json({ entry: await savedEntryView(result.entry), changed: result.changed })
  })

  router.post('/entries/:code/versions', async (req, res) => {
    const user = requireUser(res)
    const { entry, project } = await projectOfEntry(req.params.code)
    checkCanContribute(res, project)
    const body = new BodyReader(req.body)
    const note = body.optionalText('note')
    body.done()

    const created = await createVersion({ entryId: entry._id, userId: user.id, note })
    const version = created!.toObject()
    res.status(201).json(versionView(version, await findPeople([version.createdBy])))
  })

  router.get('/entries/:code/versions', async (req, res) => {
    const { entry, project } = await projectOfEntry(req.params.code)
    checkCanRead(res, project)
    const versions = await listVersions(entry._id)
    const people = await findPeople(versions.map((version) => version.createdBy))
    res.json(versions.map((version) => versionSummary(version, people)))
  })

  router.get('/entries/:code/versions/:number', async (req, res) => {
    const { entry, project } = await projectOfEntry(req.params.code)
    checkCanRead(res, project)
    const version = await findVersion(entry._id, Number(req.params.number))
    const people = await findPeople([version.createdBy])
    const named = await findPeopleNamedIn(version.content as DocNode)
    res.json(versionView(version, people, named, await fileInfoFor(version.files ?? [])))
  })

  // Recalculates the hashes of every version, reporting any that have been tampered with
  router.get('/entries/:code/history-check', async (req, res) => {
    const { entry, project } = await projectOfEntry(req.params.code)
    checkCanRead(res, project)
    const problems = await verifyVersions(entry._id)
    res.json({ intact: problems.length === 0, problems })
  })

  return router
}
