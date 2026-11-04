import type { Entry, EntrySummary, Notebook, Project, VersionSummary } from '../api'

// API answers like those for the example data (backend/src/data/demo.ts)

const carberry = { name: 'Josiah Carberry', orcid: '0000-0002-1825-0097' }
const when = '2026-11-03T18:22:31.985Z'

export const project: Project = {
  code: 'DEMO',
  title: 'Example project',
  description: 'Invented example data, for trying out ProtoELN.',
  publicRead: true,
  links: [],
  yourRole: null,
  canContribute: false,
  canManageMembers: false,
  createdAt: when,
  updatedAt: when,
}

export const notebook: Notebook = {
  id: '6aea2667810ceb3f4123d140',
  title: 'Protein assays',
  description: 'Measuring protein in cell lysates.',
  owner: carberry,
  createdAt: when,
  updatedAt: when,
}

export const protocolSummary: EntrySummary = {
  code: 'ELN-2026-0001',
  kind: 'protocol',
  title: 'Bradford assay for total protein',
  status: 'draft',
  author: carberry,
  latestVersion: 1,
  updatedAt: when,
}

export const protocol: Entry = {
  ...protocolSummary,
  canEdit: false,
  coAuthors: [],
  contentFormat: 'protoeln-doc/1',
  content: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Materials' }] },
      {
        type: 'materials',
        attrs: { items: [{ name: 'Coomassie dye reagent', lotNumber: 'EX-0042' }] },
      },
      {
        type: 'protocolStep',
        attrs: { done: false },
        content: [{ type: 'text', text: 'Read absorbance at 595 nm.' }],
      },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [] }] },
              {
                type: 'tableHeader',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A595' }] }],
              },
            ],
          },
        ],
      },
    ],
  },
  text: '',
  tags: [],
  createdAt: when,
}

export const versions: VersionSummary[] = [
  {
    number: 1,
    title: protocol.title,
    note: 'First version',
    createdBy: carberry,
    createdAt: when,
    previousHash: null,
    hash: 'a1b2c3d4e5f6'.repeat(5) + 'abcd',
  },
]
