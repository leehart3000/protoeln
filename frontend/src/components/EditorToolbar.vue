<script setup lang="ts">
import { findParentNode, type Editor, type JSONContent } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import { isInTable, selectedRect } from '@tiptap/pm/tables'
import { computed, onBeforeUnmount, onMounted, ref, type Component } from 'vue'

import {
  BoldIcon,
  BulletListIcon,
  CodeBlockIcon,
  CodeIcon,
  ColumnLeftIcon,
  ColumnRightIcon,
  DeleteIcon,
  HeaderRowIcon,
  HighlightIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  LinkIcon,
  MaterialsIcon,
  OrderedListIcon,
  ParagraphIcon,
  ProtocolStepIcon,
  QuoteIcon,
  RecordLinkIcon,
  RedoIcon,
  RowAboveIcon,
  RowBelowIcon,
  MergeCellsIcon,
  SplitCellIcon,
  SubscriptIcon,
  SuperscriptIcon,
  TableIcon,
  UndoIcon,
  UnlinkIcon,
} from '../icons'
import RecordLinkForm from '../editor/RecordLinkForm.vue'
import { inputClass, primaryButton, secondaryButton } from '../styles'

// The editor's buttons: one for each block and mark of the content format. Each button says what
// it does (its label is also its tooltip), and shows whether it's on where the cursor is. In a
// table, a second row of buttons adds and deletes rows and columns.

// `entryCode` is the entry being edited (not offered as a link to itself)
const props = defineProps<{ editor: Editor; entryCode?: string }>()

// Whether the toolbar is stuck to the top of the window, with the content scrolling beneath it.
// Then it's square-cornered with a shadow; otherwise its top corners are rounded to fit inside
// the editor's border, so the content never shows past them. A line just above it (`marker`)
// has scrolled off the top of the window when it's stuck.
const marker = ref<HTMLElement>()
const stuck = ref(false)
let watcher: IntersectionObserver | undefined
onMounted(() => {
  if (typeof IntersectionObserver === 'undefined' || !marker.value) return // as in tests
  watcher = new IntersectionObserver(([seen]) => {
    stuck.value = seen !== undefined && !seen.isIntersecting && seen.boundingClientRect.top < 0
  })
  watcher.observe(marker.value)
})
onBeforeUnmount(() => watcher?.disconnect())

interface Tool {
  label: string
  icon: Component
  run: () => void
  active?: () => boolean
  // Why it can't be used where the cursor is, if it can't
  unavailable?: () => string | undefined
}

const chain = () => props.editor.chain().focus()

// Puts a new block where the cursor is; or, when a whole block is selected (as a materials
// table is while you type in it), after that block, rather than in its place
function insertBlock(content: JSONContent) {
  const { selection } = props.editor.state
  return selection instanceof NodeSelection
    ? chain().insertContentAt(selection.to, content).run()
    : chain().insertContent(content).run()
}

// A new table, as insertTable makes: a header row and two rows of cells, three cells wide
function newRow(cell: 'tableHeader' | 'tableCell'): JSONContent {
  const cells = [1, 2, 3].map(() => ({ type: cell, content: [{ type: 'paragraph' }] }))
  return { type: 'tableRow', content: cells }
}
const NEW_TABLE: JSONContent = {
  type: 'table',
  content: [newRow('tableHeader'), newRow('tableCell'), newRow('tableCell')],
}

const GROUPS: Tool[][] = [
  [
    {
      label: 'Bold',
      icon: BoldIcon,
      run: () => chain().toggleBold().run(),
      active: () => props.editor.isActive('bold'),
    },
    {
      label: 'Italic',
      icon: ItalicIcon,
      run: () => chain().toggleItalic().run(),
      active: () => props.editor.isActive('italic'),
    },
    {
      label: 'Code',
      icon: CodeIcon,
      run: () => chain().toggleCode().run(),
      active: () => props.editor.isActive('code'),
    },
    {
      label: 'Subscript',
      icon: SubscriptIcon,
      run: () => chain().toggleSubscript().run(),
      active: () => props.editor.isActive('subscript'),
    },
    {
      label: 'Superscript',
      icon: SuperscriptIcon,
      run: () => chain().toggleSuperscript().run(),
      active: () => props.editor.isActive('superscript'),
    },
    {
      label: 'Highlight',
      icon: HighlightIcon,
      run: () => chain().toggleMark('highlight').run(),
      active: () => props.editor.isActive('highlight'),
    },
  ],
  [
    {
      label: 'Paragraph',
      icon: ParagraphIcon,
      run: () => chain().setParagraph().run(),
      active: () => props.editor.isActive('paragraph'),
    },
    {
      label: 'Heading 1',
      icon: Heading1Icon,
      run: () => chain().toggleHeading({ level: 1 }).run(),
      active: () => props.editor.isActive('heading', { level: 1 }),
    },
    {
      label: 'Heading 2',
      icon: Heading2Icon,
      run: () => chain().toggleHeading({ level: 2 }).run(),
      active: () => props.editor.isActive('heading', { level: 2 }),
    },
    {
      label: 'Heading 3',
      icon: Heading3Icon,
      run: () => chain().toggleHeading({ level: 3 }).run(),
      active: () => props.editor.isActive('heading', { level: 3 }),
    },
  ],
  [
    {
      label: 'Bulleted list',
      icon: BulletListIcon,
      run: () => chain().toggleBulletList().run(),
      active: () => props.editor.isActive('bulletList'),
    },
    {
      label: 'Numbered list',
      icon: OrderedListIcon,
      run: () => chain().toggleOrderedList().run(),
      active: () => props.editor.isActive('orderedList'),
    },
    {
      label: 'Table',
      icon: TableIcon,
      run: () =>
        props.editor.state.selection instanceof NodeSelection
          ? insertBlock(NEW_TABLE)
          : chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      active: () => props.editor.isActive('table'),
      unavailable: () =>
        props.editor.isActive('table') ? "A table can't go inside a table." : undefined,
    },
    {
      label: 'Quote',
      icon: QuoteIcon,
      run: () => chain().toggleBlockquote().run(),
      active: () => props.editor.isActive('blockquote'),
    },
    {
      label: 'Code block',
      icon: CodeBlockIcon,
      run: () => chain().toggleCodeBlock().run(),
      active: () => props.editor.isActive('codeBlock'),
    },
  ],
  [
    { label: 'Undo', icon: UndoIcon, run: () => chain().undo().run() },
    { label: 'Redo', icon: RedoIcon, run: () => chain().redo().run() },
  ],
  // Blocks for lab work: checklists of protocol steps, ticked off on the entry page, tables of
  // the materials used, and links to records (other entries, or records elsewhere)
  [
    {
      label: 'Checklist',
      icon: ProtocolStepIcon,
      run: () =>
        props.editor.isActive('protocolStep')
          ? chain().setParagraph().run()
          : chain().setNode('protocolStep', { done: false }).run(),
      active: () => props.editor.isActive('protocolStep'),
    },
    {
      label: 'Materials table',
      icon: MaterialsIcon,
      run: () => insertBlock({ type: 'materials', attrs: { items: [{ name: '' }] } }),
      active: () => props.editor.isActive('materials'),
    },
    {
      label: 'Link to record',
      icon: RecordLinkIcon,
      run: () => {
        linking.value = false
        recordLinking.value = true
      },
      active: () => recordLinking.value,
    },
  ],
]

// The table the cursor is in, if any, and whether its first row is a header row
const table = computed(
  () => findParentNode((node) => node.type.name === 'table')(props.editor.state.selection)?.node,
)
const hasHeaderRow = computed(
  () => table.value?.firstChild?.firstChild?.type.name === 'tableHeader',
)

// Whether deleting would remove every row (or column) of the table. The editor won't do that
// (it does nothing instead), so deleting the last row or column deletes the whole table.
function wouldEmpty(axis: 'rows' | 'columns') {
  const state = props.editor.state
  if (!isInTable(state)) return true
  const { top, bottom, left, right, map } = selectedRect(state)
  return axis === 'rows' ? top === 0 && bottom === map.height : left === 0 && right === map.width
}

interface TableTool {
  label: string
  icon: Component
  run: () => boolean
  // Why it can't be used where the cursor is, if it can't
  unavailable?: () => string | undefined
  pressed?: () => boolean
  // Whether it deletes something (shown in red)
  deletes?: true
}

interface TableGroup {
  name: string
  tools: TableTool[]
}

const TABLE_GROUPS: TableGroup[] = [
  {
    name: 'Table',
    tools: [
      {
        label: 'Delete table',
        icon: DeleteIcon,
        run: () => chain().deleteTable().run(),
        deletes: true,
      },
    ],
  },
  {
    name: 'Row',
    tools: [
      {
        label: 'Header row',
        icon: HeaderRowIcon,
        run: () => chain().toggleHeaderRow().run(),
        pressed: () => hasHeaderRow.value,
      },
      { label: 'Add row above', icon: RowAboveIcon, run: () => chain().addRowBefore().run() },
      { label: 'Add row below', icon: RowBelowIcon, run: () => chain().addRowAfter().run() },
      {
        label: 'Delete row',
        icon: DeleteIcon,
        deletes: true,
        run: () => (wouldEmpty('rows') ? chain().deleteTable().run() : chain().deleteRow().run()),
      },
    ],
  },
  {
    name: 'Column',
    tools: [
      {
        label: 'Add column left',
        icon: ColumnLeftIcon,
        run: () => chain().addColumnBefore().run(),
      },
      {
        label: 'Add column right',
        icon: ColumnRightIcon,
        run: () => chain().addColumnAfter().run(),
      },
      {
        label: 'Delete column',
        icon: DeleteIcon,
        deletes: true,
        run: () =>
          wouldEmpty('columns') ? chain().deleteTable().run() : chain().deleteColumn().run(),
      },
    ],
  },
  {
    name: 'Cell',
    tools: [
      {
        // Cells are selected together by dragging across them (or Shift and the arrow keys)
        label: 'Merge cells',
        icon: MergeCellsIcon,
        run: () => chain().mergeCells().run(),
        unavailable: () =>
          props.editor.can().mergeCells()
            ? undefined
            : 'Select two or more cells to merge, by dragging across them.',
      },
      {
        label: 'Split cell',
        icon: SplitCellIcon,
        run: () => chain().splitCell().run(),
        unavailable: () =>
          props.editor.can().splitCell() ? undefined : 'Only a merged cell can be split.',
      },
    ],
  },
]

const NOT_IN_LINK = 'Put the cursor in a link to remove it.'

// Adding a link asks for its address in a small form under the toolbar; adding a link to a
// record has a form of its own there (see RecordLinkForm)
const linking = ref(false)
const recordLinking = ref(false)
const href = ref('')

function startLink() {
  href.value = String(props.editor.getAttributes('link').href ?? '')
  recordLinking.value = false
  linking.value = true
}

function applyLink() {
  const address = href.value.trim()
  if (address === '') {
    chain().extendMarkRange('link').unsetLink().run()
  } else {
    chain().extendMarkRange('link').setLink({ href: address }).run()
  }
  linking.value = false
}

const toolShape =
  'inline-flex size-9 items-center justify-center rounded-md aria-pressed:bg-primary/15 aria-pressed:text-primary aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-transparent'
const toolButton = `${toolShape} text-muted hover:bg-line/50 hover:text-fg`
// Deleting is in red, so it isn't mistaken for the tools around it
const deleteButton = `${toolShape} text-danger hover:bg-danger/10`
</script>

<template>
  <div ref="marker" aria-hidden="true"></div>
  <!-- The toolbar stays in view at the top of the window while you scroll a long entry -->
  <div
    class="sticky top-0 z-10 border-b border-line bg-panel"
    :class="stuck ? 'shadow-md' : 'rounded-t-[7px]'"
  >
    <div role="toolbar" aria-label="Formatting" class="flex flex-wrap items-center gap-0.5 p-1.5">
      <template v-for="(group, index) in GROUPS" :key="index">
        <span v-if="index > 0" aria-hidden="true" class="mx-0.5 h-6 w-px bg-line"></span>
        <button
          v-for="tool in group"
          :key="tool.label"
          type="button"
          :class="toolButton"
          :aria-label="tool.label"
          :title="tool.unavailable?.() ?? tool.label"
          :aria-pressed="tool.active ? tool.active() : undefined"
          :aria-disabled="tool.unavailable?.() ? 'true' : undefined"
          @click="tool.unavailable?.() || tool.run()"
        >
          <component :is="tool.icon" aria-hidden="true" class="size-4" />
        </button>
        <template v-if="index === 0">
          <button
            type="button"
            :class="toolButton"
            aria-label="Link"
            title="Link"
            :aria-pressed="editor.isActive('link')"
            :aria-expanded="linking"
            @click="startLink"
          >
            <LinkIcon aria-hidden="true" class="size-4" />
          </button>
          <button
            type="button"
            :class="toolButton"
            aria-label="Remove link"
            :title="editor.isActive('link') ? 'Remove link' : NOT_IN_LINK"
            :aria-disabled="editor.isActive('link') ? undefined : 'true'"
            @click="editor.isActive('link') && chain().extendMarkRange('link').unsetLink().run()"
          >
            <UnlinkIcon aria-hidden="true" class="size-4" />
          </button>
        </template>
      </template>
    </div>
    <div
      v-if="table"
      role="toolbar"
      aria-label="Table"
      class="flex flex-wrap items-center gap-0.5 border-t border-line p-1.5"
    >
      <template v-for="(group, index) in TABLE_GROUPS" :key="group.name">
        <span v-if="index > 0" aria-hidden="true" class="mx-0.5 h-6 w-px bg-line"></span>
        <span aria-hidden="true" class="ml-1 text-xs font-semibold text-muted">
          {{ group.name }}:
        </span>
        <button
          v-for="tool in group.tools"
          :key="tool.label"
          type="button"
          :class="tool.deletes ? deleteButton : toolButton"
          :aria-label="tool.label"
          :title="tool.unavailable?.() ?? tool.label"
          :aria-pressed="tool.pressed?.()"
          :aria-disabled="tool.unavailable?.() ? 'true' : undefined"
          @click="tool.unavailable?.() || tool.run()"
        >
          <component :is="tool.icon" aria-hidden="true" class="size-4" />
        </button>
      </template>
    </div>
    <form
      v-if="linking"
      aria-label="Link"
      class="flex flex-wrap items-end gap-2 border-t border-line p-2"
      @submit.prevent="applyLink"
    >
      <label class="min-w-64 flex-1 text-sm font-medium">
        Link address
        <input
          v-model="href"
          type="url"
          placeholder="https://"
          :class="[inputClass, 'border-line']"
          class="font-normal"
        />
      </label>
      <button type="submit" :class="primaryButton" class="text-sm">Apply</button>
      <button type="button" :class="secondaryButton" @click="linking = false">Cancel</button>
    </form>
    <RecordLinkForm
      v-if="recordLinking"
      :entry-code="entryCode"
      :insert="insertBlock"
      @done="recordLinking = false"
    />
  </div>
</template>
