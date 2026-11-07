import { describe, expect, it } from 'vitest'

import { toMarkdown } from '../src/markdown.ts'
import { toPlainText } from '../src/plain-text.ts'
import { tableGrid } from '../src/tables.ts'
import type { DocNode, TableCellNode, TableNode } from '../src/types.ts'

function cell(text: string, attrs?: TableCellNode['attrs']): TableCellNode {
  return {
    type: 'tableCell',
    ...(attrs && { attrs }),
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  }
}

// A heading across all three columns, and a cell two rows high:
//
//   | Grid box SKD-002       |
//   | Grid 1 | apo   | 0.3  |
//   |        | halo  | 0.5  |
const table: TableNode = {
  type: 'table',
  content: [
    { type: 'tableRow', content: [cell('Grid box SKD-002', { colspan: 3 })] },
    { type: 'tableRow', content: [cell('Grid 1', { rowspan: 2 }), cell('apo'), cell('0.3')] },
    { type: 'tableRow', content: [cell('halo'), cell('0.5')] },
  ],
}

describe('tableGrid', () => {
  it('puts each cell in its place, with the places merged cells cover left empty', () => {
    const text = (place: TableCellNode | null) =>
      place ? (place.content[0] as { content: { text: string }[] }).content[0]!.text : null

    expect(tableGrid(table).map((row) => row.map(text))).toEqual([
      ['Grid box SKD-002', null, null],
      ['Grid 1', 'apo', '0.3'],
      [null, 'halo', '0.5'],
    ])
  })
})

describe('copies of a table with merged cells', () => {
  const doc: DocNode = { type: 'doc', content: [table] }

  it('keep the columns lined up in plain text', () => {
    expect(toPlainText(doc)).toBe('Grid box SKD-002\t\t\nGrid 1\tapo\t0.3\n\thalo\t0.5')
  })

  it('keep the columns lined up in Markdown', () => {
    expect(toMarkdown(doc)).toBe(
      [
        '| Grid box SKD-002 |  |  |',
        '| --- | --- | --- |',
        '| Grid 1 | apo | 0.3 |',
        '|  | halo | 0.5 |',
      ].join('\n'),
    )
  })
})
