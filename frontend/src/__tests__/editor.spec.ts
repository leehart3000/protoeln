import { afterEach, describe, expect, it } from 'vitest'
import { checkDocument, fromProseMirror } from '@protoeln/content'
import { Editor, type JSONContent } from '@tiptap/core'
import { CellSelection } from '@tiptap/pm/tables'

import { editorExtensions } from '../editor/extensions'

// The editor's own behaviour, tried on an editor by itself (without the page around it)

const TICKED = { done: true, doneBy: '0000-0002-1825-0097', doneAt: '2026-11-05T17:30:00.000Z' }

function step(text: string, attrs: Record<string, unknown> = { done: false }): JSONContent {
  return { type: 'protocolStep', attrs, content: [{ type: 'text', text }] }
}

let editor: Editor | undefined
afterEach(() => editor?.destroy())

// An editor holding these blocks, in which Enter is pressed with the cursor at `position`
function pressEnter(blocks: JSONContent[], position: number) {
  editor = new Editor({
    element: document.createElement('div'),
    extensions: editorExtensions(),
    content: { type: 'doc', content: blocks },
  })
  editor.commands.setTextSelection(position)
  editor.commands.keyboardShortcut('Enter')
  return fromProseMirror(editor.getJSON()).content
}

describe('tables in the editor', () => {
  it('merge cells, and keep them merged when saved', () => {
    const cell = (text: string) => ({
      type: 'tableCell',
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    })
    editor = new Editor({
      element: document.createElement('div'),
      extensions: editorExtensions(),
      content: {
        type: 'doc',
        content: [
          { type: 'table', content: [{ type: 'tableRow', content: [cell('A'), cell('B')] }] },
        ],
      },
    })
    // Select both cells: the table starts at 0, its row at 1, its first cell at 2
    const { tr, doc } = editor.state
    const firstCell = 2
    const secondCell = firstCell + doc.nodeAt(firstCell)!.nodeSize
    editor.view.dispatch(tr.setSelection(CellSelection.create(doc, firstCell, secondCell)))

    expect(editor.can().mergeCells()).toBe(true)
    editor.commands.mergeCells()

    const saved = fromProseMirror(editor.getJSON())
    const [table] = saved.content as { content: { content: { attrs?: unknown }[] }[] }[]
    expect(table!.content[0]!.content).toHaveLength(1)
    expect(table!.content[0]!.content[0]!.attrs).toEqual({ colspan: 2 })
    expect(checkDocument(saved)).toEqual([])
  })
})

describe('spreadsheets in the editor', () => {
  it('are named, not shown as pictures, and kept as they are', () => {
    const fileId = 'e'.repeat(64)
    const sheet = { type: 'fileBlock', attrs: { fileId } }
    const element = document.createElement('div')
    editor = new Editor({
      element,
      extensions: editorExtensions({
        [fileId]: { name: 'data.csv', contentType: 'text/csv', size: 8 },
      }),
      content: { type: 'doc', content: [sheet] },
    })

    expect(element.querySelector('img')).toBeNull()
    expect(element.textContent).toContain('File: data.csv')
    expect(fromProseMirror(editor.getJSON()).content).toEqual([sheet])
  })
})

describe('images in the editor', () => {
  it('are shown, and kept exactly as they are', () => {
    const image = {
      type: 'fileBlock',
      attrs: { fileId: 'c'.repeat(64), alt: 'A gel', caption: 'Figure 1' },
    }
    const element = document.createElement('div')
    editor = new Editor({
      element,
      extensions: editorExtensions(),
      content: { type: 'doc', content: [image] },
    })

    expect(element.querySelector('img')?.getAttribute('src')).toBe(
      `/api/v1/files/${'c'.repeat(64)}`,
    )
    expect(element.querySelector('img')?.getAttribute('alt')).toBe('A gel')
    expect(fromProseMirror(editor.getJSON()).content).toEqual([image])
  })
})

describe('protocol steps in the editor', () => {
  it('start a new, unticked step on Enter at the end of a step', () => {
    // "Mix" is at positions 1 to 4
    expect(pressEnter([step('Mix', TICKED)], 4)).toEqual([
      step('Mix', TICKED),
      { type: 'protocolStep', attrs: { done: false } },
    ])
  })

  it('split on Enter, leaving the tick with the first part', () => {
    expect(pressEnter([step('Mix well', TICKED)], 4)).toEqual([step('Mix', TICKED), step(' well')])
  })

  it('end with a paragraph on Enter in an empty step', () => {
    // The empty step starts after "Mix" (positions 0 to 5), so its inside is at 6
    const blocks = [step('Mix'), { type: 'protocolStep', attrs: { done: false } }]
    pressEnter(blocks, 6)

    expect(editor?.getJSON().content?.map((block) => block.type)).toEqual([
      'protocolStep',
      'paragraph',
    ])
  })
})
