<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed, toRef } from 'vue'

import { fetchNotebook } from '../api'
import BreadcrumbTrail from '../components/BreadcrumbTrail.vue'
import EntryTable from '../components/EntryTable.vue'
import NewButton from '../components/NewButton.vue'
import PageTitle from '../components/PageTitle.vue'
import QueryStatus from '../components/QueryStatus.vue'
import { NotebookIcon } from '../icons'
import { sectionHeading } from '../styles'

const props = defineProps<{ id: string }>()
const id = toRef(props, 'id')

const { data, isPending, isError } = useQuery({
  queryKey: ['notebook', id],
  queryFn: () => fetchNotebook(id.value),
})

const crumbs = computed(() =>
  data.value
    ? [
        { label: 'Projects', to: '/projects' },
        { label: data.value.project.code, to: `/projects/${data.value.project.code}`, mono: true },
        { label: data.value.notebook.title },
      ]
    : [{ label: 'Projects', to: '/projects' }],
)
</script>

<template>
  <BreadcrumbTrail :items="crumbs" />
  <QueryStatus :pending="isPending" :failed="isError" :missing="data === null" what="notebook">
    <template v-if="data">
      <PageTitle :icon="NotebookIcon">{{ data.notebook.title }}</PageTitle>
      <p class="mt-2 max-w-2xl text-muted">
        <template v-if="data.notebook.description">{{ data.notebook.description }} </template>
        Kept by {{ data.notebook.owner.name }}.
      </p>

      <div class="mt-8 mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 :class="sectionHeading">Entries</h2>
        <NewButton v-if="data.project.canContribute" :to="`/notebooks/${id}/entries/new`">
          New entry
        </NewButton>
      </div>
      <p v-if="data.entries.length === 0" class="text-muted">No entries yet.</p>
      <EntryTable v-else :entries="data.entries" />
    </template>
  </QueryStatus>
</template>
