<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed, type Component } from 'vue'

import { fetchAllEntries, fetchAllNotebooks, fetchProjects } from '../api'
import { EntryIcon, NotebookIcon, ProjectIcon } from '../icons'

// The home page: what ProtoELN is, and a card for each kind of record with how many the
// visitor can see, each linking to the list of them (as on protolims.org). The cards share
// their lists' queries, so going on to a list is instant.
const KINDS: {
  label: string
  one: string
  to: string
  icon: Component
  queryKey: string
  fetchAll: () => Promise<unknown[]>
}[] = [
  {
    label: 'Projects',
    one: 'Project',
    to: '/projects',
    icon: ProjectIcon,
    queryKey: 'projects',
    fetchAll: fetchProjects,
  },
  {
    label: 'Notebooks',
    one: 'Notebook',
    to: '/notebooks',
    icon: NotebookIcon,
    queryKey: 'notebooks',
    fetchAll: fetchAllNotebooks,
  },
  {
    label: 'Entries',
    one: 'Entry',
    to: '/entries',
    icon: EntryIcon,
    queryKey: 'entries',
    fetchAll: fetchAllEntries,
  },
]

const lists = KINDS.map((kind) => useQuery({ queryKey: [kind.queryKey], queryFn: kind.fetchAll }))

// Each card's count, as in "3 Entries" or "1 Entry". Until the count arrives (or if it can't be
// loaded), a dash stands in for it.
const cards = computed(() =>
  KINDS.map((kind, index) => {
    const count = lists[index]?.data.value?.length
    return {
      ...kind,
      count: count === undefined ? '–' : count.toLocaleString('en-GB'),
      name: count === 1 ? kind.one : kind.label,
    }
  }),
)
</script>

<template>
  <h1 class="font-brand text-2xl tracking-tight sm:text-3xl">
    <span class="text-fg">Welcome to Proto</span><span class="font-bold">ELN</span>
  </h1>
  <p class="mt-3 max-w-2xl text-lg text-muted">
    A prototype electronic lab notebook: write up experiments and protocols, keep the data with
    them, and keep every version, so the record can always be checked.
  </p>
  <ul aria-label="What's here" class="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
    <li v-for="card in cards" :key="card.to" class="flex">
      <RouterLink
        :to="card.to"
        class="flex flex-1 items-start gap-3 rounded-lg border border-line bg-panel p-4 font-medium hover:border-gold hover:bg-gold/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link sm:text-lg"
      >
        <component :is="card.icon" aria-hidden="true" class="size-6 shrink-0 text-primary" />
        <!-- The space is inside the {{ }}, so Vue keeps it however the lines are wrapped -->
        <span class="whitespace-nowrap">
          <span class="tabular-nums">{{ card.count }}</span
          >{{ ` ${card.name}` }}
        </span>
      </RouterLink>
    </li>
  </ul>
</template>
