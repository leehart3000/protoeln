import type mongoose from 'mongoose'

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
