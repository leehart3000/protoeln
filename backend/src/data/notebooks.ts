import mongoose from 'mongoose'

import { saveDetails } from './details.ts'
import { NotebookModel } from './models/notebook.ts'

export async function createNotebook(input: {
  projectId: mongoose.Types.ObjectId
  ownerId: string
  title: string
  description?: string
}) {
  const notebook = await NotebookModel.create(input)
  return notebook.toObject()
}

// The details of a notebook that can be changed after it's created
export interface NotebookDetails {
  title: string
  description: string
}

// Changes the details given, recording what changed (see details.ts)
export async function updateNotebook(input: {
  notebookId: mongoose.Types.ObjectId
  userId: string
  changes: Partial<NotebookDetails>
}) {
  return mongoose.connection.transaction(async (session) => {
    const notebook = await NotebookModel.findById(input.notebookId).session(session).orFail()
    const before: NotebookDetails = { title: notebook.title, description: notebook.description }
    const changed = await saveDetails({
      kind: 'notebook',
      record: notebook,
      before,
      changes: input.changes,
      userId: input.userId,
      session,
    })
    return { notebook: notebook.toObject(), changed }
  })
}
