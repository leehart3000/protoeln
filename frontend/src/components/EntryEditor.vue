<script setup lang="ts">
import { fromProseMirror } from '@protoeln/content'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'

import { saveDraft, type Entry } from '../api'
import { editorExtensions } from '../editor/extensions'
import { SaveIcon } from '../icons'
import {
  dangerButton,
  fieldLabel,
  inputClass,
  primaryButton,
  secondaryButton,
  unsavedButton,
} from '../styles'
import EditorToolbar from './EditorToolbar.vue'
import FormProblem from './FormProblem.vue'

// Editing an entry's title and draft, for its author. Save stores the draft, and the API records
// exactly what changed. If someone else saved since this draft was opened, the save is refused
// rather than overwriting their work. Leaving with unsaved changes asks first.

const props = defineProps<{ entry: Entry }>()
const emit = defineEmits<{ close: [] }>()
const queryClient = useQueryClient()

const title = ref(props.entry.title)
// The updatedAt of the draft being edited, sent with each save (see saveDraft)
const basedOn = ref(props.entry.updatedAt)
const unsaved = ref(false)
const notice = ref('')

const editor = useEditor({
  content: props.entry.content,
  extensions: editorExtensions(),
  editorProps: {
    attributes: {
      class: 'editor-content min-h-48 p-4 focus:outline-none sm:p-6',
      role: 'textbox',
      'aria-multiline': 'true',
      'aria-label': 'Entry content',
    },
  },
  onUpdate: () => {
    unsaved.value = true
    notice.value = ''
  },
})

watch(title, () => {
  unsaved.value = true
  notice.value = ''
})

const saving = useMutation({
  mutationFn: () =>
    saveDraft(props.entry.code, {
      basedOn: basedOn.value,
      title: title.value,
      content: fromProseMirror(editor.value?.getJSON()),
    }),
  onSuccess: async (result) => {
    basedOn.value = result.entry.updatedAt
    unsaved.value = false
    notice.value = result.changed ? 'Saved.' : 'Saved: nothing had changed.'
    queryClient.setQueryData(['entry', props.entry.code], (old: unknown) =>
      old && typeof old === 'object' ? { ...old, entry: result.entry } : old,
    )
    await queryClient.invalidateQueries({
      predicate: (query) => ['entries', 'notebook'].includes(String(query.queryKey[0])),
    })
  },
})

// Closing with unsaved changes asks first, on the page
const confirmingClose = ref(false)

function close() {
  if (unsaved.value) {
    confirmingClose.value = true
  } else {
    emit('close')
  }
}

// Leaving the page or the site with unsaved changes asks first too
onBeforeRouteLeave(() =>
  unsaved.value ? window.confirm('Leave without saving your changes?') : true,
)

function warnBeforeUnload(event: BeforeUnloadEvent) {
  if (unsaved.value) {
    event.preventDefault()
  }
}
onMounted(() => window.addEventListener('beforeunload', warnBeforeUnload))
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', warnBeforeUnload)
  editor.value?.destroy()
})
</script>

<template>
  <div class="mt-3 max-w-3xl space-y-4">
    <FormProblem :error="saving.error.value" />
    <div>
      <label for="entry-title" :class="fieldLabel">Title</label>
      <input id="entry-title" v-model="title" :class="[inputClass, 'border-line']" />
    </div>
    <div class="overflow-hidden rounded-lg border border-line bg-panel">
      <EditorToolbar v-if="editor" :editor="editor" />
      <EditorContent :editor="editor" />
    </div>
    <div class="flex flex-wrap items-center gap-3">
      <button
        type="button"
        :class="unsaved ? unsavedButton : secondaryButton"
        class="inline-flex items-center gap-2"
        :disabled="saving.isPending.value"
        @click="saving.mutate()"
      >
        <SaveIcon aria-hidden="true" class="size-4 shrink-0" />
        {{ saving.isPending.value ? 'Saving…' : 'Save' }}
      </button>
      <button type="button" :class="secondaryButton" @click="close">Close editor</button>
      <!-- Always present, so screen readers announce each new notice -->
      <p role="status" class="text-sm font-medium empty:hidden">
        {{ unsaved ? 'Unsaved changes' : notice }}
      </p>
    </div>
    <div
      v-if="confirmingClose"
      class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-danger-bg px-4 py-3"
    >
      <p class="text-sm font-medium text-danger">Close without saving your changes?</p>
      <div class="flex gap-2">
        <button type="button" :class="dangerButton" @click="emit('close')">
          Close without saving
        </button>
        <button
          type="button"
          :class="primaryButton"
          class="text-sm"
          @click="confirmingClose = false"
        >
          Keep editing
        </button>
      </div>
    </div>
  </div>
</template>
