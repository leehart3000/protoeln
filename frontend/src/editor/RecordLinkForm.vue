<script setup lang="ts">
import type { JSONContent } from '@tiptap/core'
import { useQuery } from '@tanstack/vue-query'
import { computed, onMounted, ref } from 'vue'

import { fetchAllEntries, type EntryListItem } from '../api'
import { linkTarget, linkToAddress, linkToEntry } from '../records'
import { inputClass, primaryButton, secondaryButton } from '../styles'

// Adding a link to a record, under the editor's toolbar: choose one of the entries you've most
// recently changed, or type to find any entry you can read (by its title or code); or paste the
// address of a record elsewhere (such as a sample in ProtoLIMS), give it a label, and add it.

const props = defineProps<{
  // The entry being edited, which isn't offered
  entryCode?: string
  insert: (content: JSONContent) => void
}>()
const emit = defineEmits<{ done: [] }>()

const query = ref('')
const label = ref('')
const search = ref<HTMLInputElement>()
onMounted(() => search.value?.focus())

const entries = useQuery({ queryKey: ['entries'], queryFn: fetchAllEntries })

// What the address would link to, if what's typed is a web address
const addressLink = computed(() => linkToAddress(query.value.trim(), label.value.trim()))

// The entries offered: before anything is typed, the most recently changed (the API lists them
// newest first); then those whose code or title contains what's typed. At most 8, so the list
// stays short however many entries there are.
const wanted = computed(() => query.value.trim().toLowerCase())
const matches = computed(() => {
  if (addressLink.value) return []
  return (entries.data.value ?? [])
    .filter((entry) => entry.code !== props.entryCode)
    .filter((entry) => `${entry.code} ${entry.title}`.toLowerCase().includes(wanted.value))
    .slice(0, 8)
})

function add(attrs: object) {
  props.insert({ type: 'recordLink', attrs })
  emit('done')
}

function addEntry(entry: EntryListItem) {
  add(linkToEntry(entry))
}

function addAddress() {
  if (addressLink.value) add(addressLink.value)
}
</script>

<template>
  <form
    aria-label="Link to record"
    class="space-y-2 border-t border-line p-2"
    @submit.prevent="addAddress"
  >
    <label class="block text-sm font-medium">
      Find an entry, or paste the address of a record elsewhere
      <input
        ref="search"
        v-model="query"
        type="search"
        placeholder="A title or code, or https://…"
        :class="[inputClass, 'border-line']"
        class="font-normal"
      />
    </label>
    <p v-if="wanted === '' && matches.length > 0" class="text-sm text-muted">
      Recently changed entries:
    </p>
    <ul
      v-if="matches.length > 0"
      :aria-label="wanted === '' ? 'Recently changed entries' : 'Matching entries'"
      class="divide-y divide-line rounded-md border border-line"
    >
      <li v-for="entry in matches" :key="entry.code">
        <button
          type="button"
          class="flex w-full flex-wrap gap-x-3 px-3 py-2 text-left text-sm hover:bg-line/50"
          @click="addEntry(entry)"
        >
          <span class="font-mono text-muted">{{ entry.code }}</span>
          <span>{{ entry.title }}</span>
        </button>
      </li>
    </ul>
    <p v-else-if="wanted !== '' && !addressLink" class="text-sm text-muted">
      No entries you can read match. To link elsewhere, paste an address starting https://.
    </p>
    <template v-if="addressLink">
      <label class="block text-sm font-medium">
        Label
        <input
          v-model="label"
          placeholder="Such as Sample S-0042"
          :class="[inputClass, 'border-line']"
          class="font-normal"
        />
      </label>
      <p class="text-sm text-muted">
        Shown as: {{ addressLink.label }} ({{ linkTarget(addressLink) }})
      </p>
    </template>
    <div class="flex gap-2">
      <button v-if="addressLink" type="submit" :class="primaryButton" class="text-sm">
        Add link
      </button>
      <button type="button" :class="secondaryButton" class="text-sm" @click="emit('done')">
        Cancel
      </button>
    </div>
  </form>
</template>
