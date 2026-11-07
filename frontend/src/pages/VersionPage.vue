<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed, toRef } from 'vue'

import { fetchEntry, fetchVersion } from '../api'
import BreadcrumbTrail from '../components/BreadcrumbTrail.vue'
import ContentBlocks from '../components/ContentBlocks.vue'
import PageTitle from '../components/PageTitle.vue'
import QueryStatus from '../components/QueryStatus.vue'
import { formatDateTime } from '../format'
import { VersionIcon } from '../icons'
import { textLink } from '../styles'

// One version of an entry, exactly as it was made: who made it and when, its note, its
// fingerprint (and the one before it, which it includes), and its content. A version never
// changes, so there's nothing to edit here; the entry's draft may have moved on since.

const props = defineProps<{ code: string; number: string }>()
const code = toRef(props, 'code')
const number = computed(() => Number(props.number))

const entry = useQuery({
  queryKey: ['entry', code],
  queryFn: () => fetchEntry(code.value),
})
const version = useQuery({
  queryKey: ['entry', code, 'versions', number],
  queryFn: () => fetchVersion(code.value, number.value),
})

const crumbs = computed(() => {
  const found = entry.data.value
  if (!found) return [{ label: 'Projects', to: '/projects' }]
  return [
    { label: 'Projects', to: '/projects' },
    { label: found.project.code, to: `/projects/${found.project.code}`, mono: true },
    { label: found.notebook.title, to: `/notebooks/${found.notebook.id}` },
    { label: found.entry.code, to: `/entries/${found.entry.code}`, mono: true },
    { label: `Version ${number.value}` },
  ]
})
</script>

<template>
  <BreadcrumbTrail :items="crumbs" />
  <QueryStatus
    :pending="version.isPending.value"
    :failed="version.isError.value"
    :missing="version.data.value === null"
    what="version"
  >
    <template v-if="version.data.value">
      <PageTitle :icon="VersionIcon">{{ version.data.value.title }}</PageTitle>
      <p class="mt-2 max-w-2xl text-muted">
        Version {{ version.data.value.number }} of the entry
        <RouterLink :to="`/entries/${code}`" :class="textLink" class="font-mono">{{
          code
        }}</RouterLink
        >, exactly as it was made. A version can't be changed.
      </p>
      <dl class="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <template v-if="version.data.value.note">
          <dt class="text-muted">Note</dt>
          <dd>{{ version.data.value.note }}</dd>
        </template>
        <dt class="text-muted">Made by</dt>
        <dd>{{ version.data.value.createdBy.name }}</dd>
        <dt class="text-muted">Made</dt>
        <dd>{{ formatDateTime(version.data.value.createdAt) }}</dd>
        <dt class="text-muted">Fingerprint</dt>
        <dd class="font-mono break-all">{{ version.data.value.hash }}</dd>
        <dt class="text-muted">Previous</dt>
        <dd v-if="version.data.value.previousHash" class="font-mono break-all">
          {{ version.data.value.previousHash }}
        </dd>
        <dd v-else>None: this is the first version</dd>
      </dl>
      <div
        class="mt-6 max-w-3xl space-y-3 rounded-lg border border-line bg-panel p-4 wrap-break-word sm:p-6"
      >
        <ContentBlocks
          v-if="version.data.value.content.content.length > 0"
          :blocks="version.data.value.content.content"
          :people="version.data.value.contentPeople"
          :files="version.data.value.contentFiles"
        />
        <p v-else class="text-muted">This version is empty.</p>
      </div>
    </template>
  </QueryStatus>
</template>
