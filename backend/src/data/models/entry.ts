import mongoose, { type InferSchemaType } from 'mongoose'

export const ENTRY_KINDS = ['experiment', 'protocol', 'note'] as const
export const ENTRY_STATUSES = [
  'draft',
  'in_review',
  'changes_requested',
  'approved',
  'signed',
  'witnessed',
] as const

// The format of stored entry content (see docs/data-model.md, "Entry content")
export const CONTENT_FORMAT = 'protoeln-doc/1'

// A named entity found in the entry's text, such as a gene, chemical or cell line
const entitySchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    label: { type: String, required: true },
    // Where in the plain text it was found, if known
    start: { type: Number },
    end: { type: Number },
    // Found by the named-entity recognition model, or added by a person
    source: { type: String, enum: ['model', 'person'], required: true },
  },
  { _id: false },
)

// Where an imported entry came from (see data/imports.ts), crediting its original authors by
// name: the record it was imported from, its DOI, who wrote it, when it was published, its
// licence, how to cite it, and what the import changed (as licences such as CC BY 4.0 ask).
// Entries written in ProtoELN have none.
const sourceSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    doi: { type: String, default: '' },
    authors: { type: [String], default: [] },
    // As YYYY-MM-DD
    publishedOn: { type: String, default: '' },
    licence: { type: String, default: '' },
    citation: { type: String, default: '' },
    changes: { type: String, default: '' },
  },
  { _id: false },
)

const entrySchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, match: /^ELN-\d{4}-\d{4,}$/ },
    notebookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Notebook', required: true },
    kind: { type: String, enum: ENTRY_KINDS, required: true },
    title: { type: String, required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    coAuthorIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
    status: { type: String, enum: ENTRY_STATUSES, default: 'draft' },
    // The saved draft, in the format named by contentFormat
    contentFormat: { type: String, enum: [CONTENT_FORMAT], default: CONTENT_FORMAT },
    content: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ type: 'doc', content: [] }),
    },
    // A plain-text copy of the content, for full-text search
    text: { type: String, default: '' },
    // The codes of the entries the content links to, so an entry can list what links to it
    linkedEntries: { type: [String], default: [] },
    // The ids (SHA-256s) of the files the content shows, so a file can be shown to whoever can
    // read an entry that shows it (see data/files.ts)
    files: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    entities: { type: [entitySchema], default: [] },
    // The number of the latest version (0 until the first version is created)
    latestVersion: { type: Number, default: 0, min: 0 },
    // Set when this entry is an addendum correcting a signed entry
    addendumTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Entry' },
    // Set when this entry was imported from elsewhere
    source: { type: sourceSchema, default: null },
  },
  { collection: 'entries', timestamps: true, minimize: false },
)

entrySchema.index({ notebookId: 1, updatedAt: -1 })
entrySchema.index({ linkedEntries: 1 })
entrySchema.index({ files: 1 })
// So an import can tell which records it has imported already
entrySchema.index({ 'source.url': 1 }, { sparse: true })

export type Entry = InferSchemaType<typeof entrySchema>
export const EntryModel = mongoose.model('Entry', entrySchema)
