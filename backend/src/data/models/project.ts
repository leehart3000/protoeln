import mongoose, { type InferSchemaType } from 'mongoose'

export const PROJECT_ROLES = ['admin', 'member', 'viewer'] as const

// 2 to 10 capital letters and digits, starting with a letter, such as LAB or ONC2
export const PROJECT_CODE = /^[A-Z][A-Z0-9]{1,9}$/
export type ProjectRole = (typeof PROJECT_ROLES)[number]

const memberSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: PROJECT_ROLES, required: true },
  },
  { _id: false },
)

// A link records that the project is related to a record elsewhere, such as a ProtoLIMS project
const linkSchema = new mongoose.Schema({
  system: { type: String, required: true },
  kind: { type: String, required: true },
  externalId: { type: String },
  url: { type: String, required: true },
  label: { type: String },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  addedAt: { type: Date, default: Date.now },
})

const projectSchema = new mongoose.Schema(
  {
    // A short code, unique across ProtoELN: capital letters and digits, starting with a letter
    code: { type: String, required: true, unique: true, match: PROJECT_CODE },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    members: { type: [memberSchema], default: [] },
    links: { type: [linkSchema], default: [] },
    // Whether anyone, signed in or not, can read the project (as on the public demo)
    publicRead: { type: Boolean, default: false },
  },
  { collection: 'projects', timestamps: true },
)

export type Project = InferSchemaType<typeof projectSchema>
export const ProjectModel = mongoose.model('Project', projectSchema)
