import mongoose, { type InferSchemaType } from 'mongoose'

const notebookSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    // Usually the scientist whose notebook it is
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { collection: 'notebooks', timestamps: true },
)

notebookSchema.index({ projectId: 1, title: 1 })

export type Notebook = InferSchemaType<typeof notebookSchema>
export const NotebookModel = mongoose.model('Notebook', notebookSchema)
