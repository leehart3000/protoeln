<script setup lang="ts">
import { findParentNode, type Editor } from '@tiptap/core'
import { isInTable, selectedRect } from '@tiptap/pm/tables'
import { computed, ref, type Component } from 'vue'

import {
  BoldIcon,
  BulletListIcon,
  CodeBlockIcon,
  CodeIcon,
  ColumnLeftIcon,
  ColumnRightIcon,
  DeleteIcon,
  HeaderRowIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  LinkIcon,
  OrderedListIcon,
  ParagraphIcon,
  ProtocolStepIcon,
  QuoteIcon,
  RedoIcon,
  RowAboveIcon,
  RowBelowIcon,
  SplitCellIcon,
  SubscriptIcon,
  SuperscriptIcon,
  TableIcon,
  UndoIcon,
  UnlinkIcon,
} from '../icons'
import { inputClass, primaryButton, secondaryButton } from '../styles'

// The editor's buttons: one for each block and mark of the content format. Each button says what
// it does (its label is also its tooltip), and shows whether it's on where the cursor is. In a
// table, a second row of buttons adds and deletes rows and columns.

const props = defineProps<{ editor: Editor }>()

interface Tool {
  label: string
  icon: Component
  run: () => void
  active?: () => boolean
  // Why it can't be used where the cursor is, if it can't
  unavailable?: () => string | undefined
}

const chain = () => props.editor.chain().focus()

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
      label: 'Protocol step',
      icon: ProtocolStepIcon,
      run: () =>
        props.editor.isActive('protocolStep')
          ? chain().setParagraph().run()
          : chain().setNode('protocolStep', { done: false }).run(),
      active: () => props.editor.isActive('protocolStep'),
    },
    {
      label: 'Table',
      icon: TableIcon,
      run: () => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
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
}

interface TableGroup {
  name: string
  tools: TableTool[]
  // Whether it's shown (always, if not given)
  shown?: () => boolean
}

const TABLE_GROUPS: TableGroup[] = [
  {
    name: 'Table',
    tools: [{ label: 'Delete table', icon: DeleteIcon, run: () => chain().deleteTable().run() }],
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
        run: () =>
          wouldEmpty('columns') ? chain().deleteTable().run() : chain().deleteColumn().run(),
      },
    ],
  },
  {
    // Merged cells aren't in the content format; one pasted in can be split here
    name: 'Cell',
    tools: [{ label: 'Split cell', icon: SplitCellIcon, run: () => chain().splitCell().run() }],
    shown: () => props.editor.can().splitCell(),
  },
]

const tableGroups = computed(() => TABLE_GROUPS.filter((group) => group.shown?.() ?? true))

// Adding a link asks for its address in a small form under the toolbar
const linking = ref(false)
const href = ref('')

function startLink() {
  href.value = String(props.editor.getAttributes('link').href ?? '')
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

const toolButton =
  'inline-flex size-9 items-center justify-center rounded-md text-muted hover:bg-line/50 hover:text-fg aria-pressed:bg-primary/15 aria-pressed:text-primary aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-transparent'
</script>

<template>
  <div class="border-b border-line">
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
            v-if="editor.isActive('link')"
            type="button"
            :class="toolButton"
            aria-label="Remove link"
            title="Remove link"
            @click="chain().extendMarkRange('link').unsetLink().run()"
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
      <template v-for="(group, index) in tableGroups" :key="group.name">
        <span v-if="index > 0" aria-hidden="true" class="mx-0.5 h-6 w-px bg-line"></span>
        <span aria-hidden="true" class="ml-1 text-xs font-semibold text-muted uppercase">
          {{ group.name }}:
        </span>
        <button
          v-for="tool in group.tools"
          :key="tool.label"
          type="button"
          :class="toolButton"
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
  </div>
</template>
