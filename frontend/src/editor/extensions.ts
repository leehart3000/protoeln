import type { RecordLinkNode } from '@protoeln/content'
import { Extension, mergeAttributes, Node, type Extensions } from '@tiptap/core'
import { Subscript } from '@tiptap/extension-subscript'
import { Superscript } from '@tiptap/extension-superscript'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import type { DOMOutputSpec } from '@tiptap/pm/model'
import { TableView } from '@tiptap/pm/tables'
import { StarterKit } from '@tiptap/starter-kit'
import { VueNodeViewRenderer } from '@tiptap/vue-3'

import { linkTarget } from '../records'
import MaterialsView from './MaterialsView.vue'

// The Tiptap editor's set-up: exactly the blocks and marks of ProtoELN's content format
// (protoeln-doc/1, see docs/content-format.md), so whatever it makes can be stored. StarterKit's
// extras that the format doesn't have are turned off. Tiptap's JSON goes through fromProseMirror
// (in @protoeln/content) before it's saved.

// A protocol step: a line of text that can be ticked off at the bench. Its tick box is drawn
// by CSS (see .protocol-step in index.css); ticking steps comes in a later step.
const ProtocolStep = Node.create({
  name: 'protocolStep',
  group: 'block',
  content: 'inline*',
  defining: true,
  addAttributes() {
    return {
      done: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-done') === 'true',
        renderHTML: (attributes) => ({ 'data-done': String(attributes.done === true) }),
      },
      doneBy: { default: null, rendered: false },
      doneAt: { default: null, rendered: false },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-type="protocol-step"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'protocol-step', class: 'protocol-step' }),
      0,
    ]
  },
})

// Enter in a protocol step works as in a list: it starts a new step, unticked (a tick is only
// ever made on the entry page), and Enter in an empty step ends the steps with a paragraph.
// This is an extension of its own, with a high priority, so it comes before the editor's own
// Enter (which would start a paragraph); the step's node keeps the usual priority, so that
// paragraphs stay the editor's default block.
const ProtocolStepKeys = Extension.create({
  name: 'protocolStepKeys',
  priority: 1000,
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { $from, $to } = editor.state.selection
        if ($from.parent.type.name !== 'protocolStep' || !$from.sameParent($to)) return false
        if ($from.parent.content.size === 0) {
          return editor.commands.setNode('paragraph')
        }
        // One change, which says it was handled, so the editor's own Enter doesn't run as well
        return editor.commands.command(({ tr, state, dispatch }) => {
          const type = state.schema.nodes.protocolStep
          if (type === undefined) return false
          if (dispatch) {
            tr.deleteSelection()
            tr.split(tr.selection.from, 1, [{ type, attrs: { done: false } }])
            tr.scrollIntoView()
          }
          return true
        })
      },
    }
  },
})

// Tables are drawn inside a box of their own (div.tableWrapper), which scrolls sideways when a
// table is too wide for the editor, as on the entry page, so the page never gets wider than
// the window. Columns are at least 80 pixels wide, so cells stay readable on phones.
const ScrollingTable = Table.extend({
  addNodeView() {
    return ({ node }) => new TableView(node, 80)
  },
})

// A block that the editor shows and keeps exactly as it is, but can't change yet (data, files
// and links to records elsewhere): it's described in a line of text, and can be moved or
// deleted as a whole.
function keptBlock(
  name: string,
  attributes: Record<string, unknown>,
  describe: (attrs: Record<string, unknown>) => string,
) {
  return Node.create({
    name,
    group: 'block',
    atom: true,
    selectable: true,
    addAttributes() {
      return Object.fromEntries(
        Object.entries(attributes).map(([key, value]) => [
          key,
          { default: value, rendered: false },
        ]),
      )
    },
    parseHTML() {
      return [{ tag: `div[data-type="${name}"]` }]
    },
    renderHTML({ node }) {
      return [
        'div',
        { 'data-type': name, class: 'kept-block', contenteditable: 'false' },
        describe(node.attrs),
      ]
    },
  })
}

// Materials: a table of the reagents and consumables used, edited in place (see MaterialsView)
const Materials = Node.create({
  name: 'materials',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes() {
    return { items: { default: [], rendered: false } }
  },
  parseHTML() {
    return [{ tag: 'div[data-type="materials"]' }]
  },
  renderHTML() {
    return ['div', { 'data-type': 'materials' }]
  },
  addNodeView() {
    return VueNodeViewRenderer(MaterialsView)
  },
})

const DataBlock = keptBlock('dataBlock', { dataItemId: '' }, () => 'Data')

// An image (see ContentImage): shown in the editor too, and kept as it is. Adding images in
// the editor comes later; for now they come from imports.
const FileBlock = Node.create({
  name: 'fileBlock',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      fileId: { default: '', rendered: false },
      caption: { default: null, rendered: false },
      alt: { default: null, rendered: false },
    }
  },
  parseHTML() {
    return [{ tag: 'figure[data-type="fileBlock"]' }]
  },
  renderHTML({ node }) {
    const { fileId, caption, alt } = node.attrs as {
      fileId: string
      caption: string | null
      alt: string | null
    }
    const image: DOMOutputSpec = /^[0-9a-f]{64}$/.test(fileId)
      ? ['img', { src: `/api/v1/files/${fileId}`, alt: alt ?? '', class: 'editor-image' }]
      : ['p', {}, 'Image']
    return [
      'figure',
      { 'data-type': 'fileBlock', class: 'kept-block', contenteditable: 'false' },
      image,
      ['figcaption', {}, caption ?? ''],
    ]
  },
})

const RecordLink = keptBlock(
  'recordLink',
  { system: '', kind: '', url: '', label: '', externalId: null },
  (attrs) => `${String(attrs.label)} (${linkTarget(attrs as RecordLinkNode['attrs'])})`,
)

export function editorExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      // Not in the content format
      strike: false,
      underline: false,
      horizontalRule: false,
      // Editors keep an empty paragraph at the end to type into; ours doesn't need one
      trailingNode: false,
    }),
    Subscript,
    Superscript,
    ScrollingTable,
    TableRow,
    TableHeader,
    TableCell,
    ProtocolStep,
    ProtocolStepKeys,
    Materials,
    DataBlock,
    FileBlock,
    RecordLink,
  ]
}
