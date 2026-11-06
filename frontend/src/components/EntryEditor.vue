<script setup lang="ts">
import { fromProseMirror } from '@protoeln/content'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'

import { ApiError, saveDraft, type Entry } from '../api'
import { editorExtensions } from '../editor/extensions'
import { CloseIcon, SavedIcon, SaveIcon, UnsavedIcon, VersionIcon } from '../icons'
import {
  dangerButton,
  fieldLabel,
  inputClass,
  primaryButton,
  secondaryButton,
  unsavedButton,
} from '../styles'
import DisabledButton from './DisabledButton.vue'
import EditorToolbar from './EditorToolbar.vue'
import FormProblem from './FormProblem.vue'
import VersionForm from './VersionForm.vue'

// Editing an entry's title and draft, for its author. Save stores the draft, and the API records
// exactly what changed. If someone else saved since this draft was opened, the save is refused
// rather than overwriting their work. Leaving with unsaved changes asks first. A version can be
// made while editing, once the changes are saved (a version is of the draft as last saved).

const props = defineProps<{ entry: Entry }>()
const emit = defineEmits<{ close: [] }>()
const queryClient = useQueryClient()

const title = ref(props.entry.title)
// The updatedAt of the draft being edited, sent with each save (see saveDraft)
const basedOn = ref(props.entry.updatedAt)
const unsaved = ref(false)
const notice = ref('')

// An empty entry starts as one empty paragraph, as an editor needs somewhere for the cursor to
// be (and fromProseMirror leaves an empty last paragraph out again when saving)
const EMPTY = { type: 'doc', content: [{ type: 'paragraph' }] }

const editor = useEditor({
  content: props.entry.content.content.length > 0 ? props.entry.content : EMPTY,
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
    notice.value = result.changed ? 'Saved' : 'Saved (nothing had changed)'
    queryClient.setQueryData(['entry', props.entry.code], (old: unknown) =>
      old && typeof old === 'object' ? { ...old, entry: result.entry } : old,
    )
    await queryClient.invalidateQueries({
      predicate: (query) => ['entries', 'notebook'].includes(String(query.queryKey[0])),
    })
  },
})

// What's wrong with the content, when a save is refused for it (such as a merged table cell),
// each with where it is in the content (as checkDocument in @protoeln/content writes it)
const contentProblems = computed(() => {
  const error = saving.error.value
  return error instanceof ApiError ? error.problems : []
})

// Closing with unsaved changes asks first, on the page
const confirmingClose = ref(false)
const versioning = ref(false)

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
    <ul
      v-if="contentProblems.length > 0"
      class="list-disc space-y-1 pl-6 text-sm font-medium text-danger"
      aria-label="Problems"
    >
      <li v-for="problem in contentProblems" :key="problem.path + problem.message">
        <span class="font-mono">{{ problem.path }}</span
        >: {{ problem.message }}
      </li>
    </ul>
    <div>
      <label for="entry-title" :class="fieldLabel">Title</label>
      <input id="entry-title" v-model="title" :class="[inputClass, 'border-line']" />
    </div>
    <div class="rounded-lg border border-line bg-panel">
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
      <DisabledButton
        v-if="unsaved"
        :icon="VersionIcon"
        :button-class="secondaryButton"
        reason="Save your changes first: a version is of the draft as last saved."
        align="start"
      >
        Create version
      </DisabledButton>
      <button
        v-else-if="!versioning"
        type="button"
        :class="secondaryButton"
        class="inline-flex items-center gap-2"
        @click="versioning = true"
      >
        <VersionIcon aria-hidden="true" class="size-4 shrink-0" />
        Create version
      </button>
      <button
        type="button"
        :class="secondaryButton"
        class="inline-flex items-center gap-2"
        @click="close"
      >
        <CloseIcon aria-hidden="true" class="size-4 shrink-0" />
        Close editor
      </button>
      <!-- Always present, so screen readers announce each new notice -->
      <p role="status" class="text-sm font-medium empty:hidden">
        <span v-if="unsaved" class="inline-flex items-center gap-1.5 text-danger">
          <UnsavedIcon aria-hidden="true" class="size-4 shrink-0" />Unsaved changes
        </span>
        <span v-else-if="notice" class="inline-flex items-center gap-1.5 text-primary">
          <SavedIcon aria-hidden="true" class="size-4 shrink-0" />{{ notice }}
        </span>
      </p>
    </div>
    <VersionForm v-if="versioning && !unsaved" :code="entry.code" @close="versioning = false" />
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
