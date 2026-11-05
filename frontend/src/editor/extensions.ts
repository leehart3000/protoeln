import { Extension, mergeAttributes, Node, type Extensions } from '@tiptap/core'
import { Subscript } from '@tiptap/extension-subscript'
import { Superscript } from '@tiptap/extension-superscript'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { StarterKit } from '@tiptap/starter-kit'

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

// A block that the editor shows and keeps exactly as it is, but can't change yet (materials,
// data, files and links to records elsewhere): it's described in a line of text, and can be
// moved or deleted as a whole.
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

interface Material {
  name?: string
  lotNumber?: string
}

const Materials = keptBlock('materials', { items: [] }, (attrs) => {
  const items = (attrs.items as Material[]).map((item) =>
    item.lotNumber ? `${item.name} (lot ${item.lotNumber})` : String(item.name),
  )
  return `Materials: ${items.join('; ') || 'none'}`
})

const DataBlock = keptBlock('dataBlock', { dataItemId: '' }, () => 'Data')

const FileBlock = keptBlock('fileBlock', { fileId: '', caption: null }, (attrs) =>
  attrs.caption ? `File: ${String(attrs.caption)}` : 'File',
)

const RecordLink = keptBlock(
  'recordLink',
  { system: '', kind: '', url: '', label: '', externalId: null },
  (attrs) => `${String(attrs.label)} (${String(attrs.system)} ${String(attrs.kind)})`,
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
    Table,
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
