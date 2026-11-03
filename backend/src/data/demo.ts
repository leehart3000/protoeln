import type { BlockNode, DocNode, InlineNode } from '@protoeln/content'

import { createEntry, createVersion, saveDraft } from './entries.ts'
import { EntryModel } from './models/entry.ts'
import { ProjectModel } from './models/project.ts'
import { createNotebook } from './notebooks.ts'
import { rememberUser } from './sessions.ts'

// Example data for development: one project with a notebook and a few entries, so the pages have
// something to show. Everything here is invented and says so. The public demo at protoeln.org
// will use real open data instead, imported by its own scripts.

export const DEMO_PROJECT_CODE = 'DEMO'

// Josiah Carberry is a fictional researcher whose ORCID iD ORCID publishes for testing, so the
// example author can never be mistaken for a real person
const DEMO_AUTHOR = { orcid: '0000-0002-1825-0097', name: 'Josiah Carberry' }

const text = (value: string): InlineNode[] => [{ type: 'text', text: value }]
const paragraph = (value: string): BlockNode => ({ type: 'paragraph', content: text(value) })
const heading = (value: string): BlockNode => ({
  type: 'heading',
  attrs: { level: 2 },
  content: text(value),
})
const step = (value: string): BlockNode => ({
  type: 'protocolStep',
  attrs: { done: false },
  content: text(value),
})
const doc = (...content: BlockNode[]): DocNode => ({ type: 'doc', content })

function table(header: string[], rows: string[][]): BlockNode {
  const row = (cells: string[], type: 'tableHeader' | 'tableCell') => ({
    type: 'tableRow' as const,
    content: cells.map((cell) => ({ type, content: [paragraph(cell)] })),
  })
  return {
    type: 'table',
    content: [row(header, 'tableHeader'), ...rows.map((cells) => row(cells, 'tableCell'))],
  }
}

const NOTICE = paragraph('Example data, invented for trying out ProtoELN.')

const protocol = doc(
  NOTICE,
  heading('Materials'),
  {
    type: 'materials',
    attrs: {
      items: [
        { name: 'Coomassie dye reagent', supplier: 'Example Supplies', lotNumber: 'EX-0042' },
        { name: 'Bovine serum albumin standard, 2 mg/mL', lotNumber: 'EX-0107' },
        { name: '96-well clear flat-bottom plate' },
      ],
    },
  },
  heading('Steps'),
  step('Make BSA standards from 0 to 2 mg/mL by serial dilution in lysis buffer.'),
  step('Add 5 µL of each standard and sample to the plate, in triplicate.'),
  step('Add 250 µL of dye reagent to each well and mix on a shaker for 30 seconds.'),
  step('Incubate at room temperature for 10 minutes.'),
  step('Read absorbance at 595 nm.'),
)

const results = table(
  ['Sample', 'A595 (mean of 3)', 'Protein (mg/mL)'],
  [
    ['Lysate A', '0.62', '1.18'],
    ['Lysate B', '0.55', '1.02'],
    ['Lysate C', '0.71', '1.39'],
  ],
)

const experimentFirst = doc(
  NOTICE,
  heading('Aim'),
  paragraph('Measure the total protein in three cell lysates before the western blot.'),
  heading('Results'),
  results,
)

const experimentSecond = doc(
  ...experimentFirst.content,
  heading('Conclusion'),
  paragraph('All three lysates are between 1 and 1.4 mg/mL. Load 20 µg of each on the gel.'),
)

const note = doc(
  NOTICE,
  paragraph('Plate reader: endpoint read at 595 nm, 25 flashes per well, no shaking.'),
)

// Adds the example project, unless it is there already. Returns whether it was added.
export async function addDemoData(): Promise<{ added: boolean; entryCodes: string[] }> {
  if ((await ProjectModel.exists({ code: DEMO_PROJECT_CODE })) !== null) {
    return { added: false, entryCodes: [] }
  }

  const author = await rememberUser(DEMO_AUTHOR.orcid, DEMO_AUTHOR.name)
  const project = await ProjectModel.create({
    code: DEMO_PROJECT_CODE,
    title: 'Example project',
    description: 'Invented example data, for trying out ProtoELN.',
    publicRead: true,
    members: [{ userId: author._id, role: 'admin' }],
  })
  const notebook = await createNotebook({
    projectId: project._id,
    ownerId: String(author._id),
    title: 'Protein assays',
    description: 'Measuring protein in cell lysates.',
  })
  const entry = (kind: 'protocol' | 'experiment' | 'note', title: string, content: DocNode) =>
    createEntry({ notebookId: notebook._id, authorId: author._id, kind, title, content })

  // A protocol with one version
  const bradford = await entry('protocol', 'Bradford assay for total protein', protocol)
  await createVersion({ entryId: bradford._id, userId: author._id, note: 'First version' })

  // An experiment saved twice, with a version after each save, so it has a history
  const lysates = await entry('experiment', 'Protein in lysates A to C', experimentFirst)
  await createVersion({ entryId: lysates._id, userId: author._id, note: 'Results recorded' })
  const current = await EntryModel.findById(lysates._id).orFail()
  await saveDraft({
    entryId: lysates._id,
    userId: author._id,
    basedOn: current.updatedAt,
    title: current.title,
    content: experimentSecond,
  })
  await createVersion({ entryId: lysates._id, userId: author._id, note: 'Conclusion added' })

  // A note that is still a draft, with no versions
  const settings = await entry('note', 'Plate reader settings', note)

  return { added: true, entryCodes: [bradford.code, lysates.code, settings.code] }
}
