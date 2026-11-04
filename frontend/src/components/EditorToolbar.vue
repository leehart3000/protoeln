<script setup lang="ts">
import type { Editor } from '@tiptap/core'
import { ref, type Component } from 'vue'

import {
  BoldIcon,
  BulletListIcon,
  CodeBlockIcon,
  CodeIcon,
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
  SubscriptIcon,
  SuperscriptIcon,
  UndoIcon,
  UnlinkIcon,
} from '../icons'
import { inputClass, primaryButton, secondaryButton } from '../styles'

// The editor's buttons: one for each block and mark of the content format. Each button says what
// it does (its label is also its tooltip), and shows whether it's on where the cursor is.

const props = defineProps<{ editor: Editor }>()

interface Tool {
  label: string
  icon: Component
  run: () => void
  active?: () => boolean
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
  'inline-flex size-9 items-center justify-center rounded-md text-muted hover:bg-line/50 hover:text-fg aria-pressed:bg-primary/15 aria-pressed:text-primary'
</script>

<template>
  <div class="border-b border-line">
    <div role="toolbar" aria-label="Formatting" class="flex flex-wrap items-center gap-1 p-1.5">
      <template v-for="(group, index) in GROUPS" :key="index">
        <span v-if="index > 0" aria-hidden="true" class="mx-1 h-6 w-px bg-line"></span>
        <button
          v-for="tool in group"
          :key="tool.label"
          type="button"
          :class="toolButton"
          :aria-label="tool.label"
          :title="tool.label"
          :aria-pressed="tool.active ? tool.active() : undefined"
          @click="tool.run"
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
