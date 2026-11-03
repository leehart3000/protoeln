<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed, toRef } from 'vue'

import { fetchNotebook } from '../api'
import BreadcrumbTrail from '../components/BreadcrumbTrail.vue'
import PageTitle from '../components/PageTitle.vue'
import QueryStatus from '../components/QueryStatus.vue'
import { formatDateTime, KIND_LABELS, STATUS_LABELS } from '../format'
import { NotebookIcon } from '../icons'
import {
  badge,
  rowLink,
  sectionHeading,
  table,
  tableCell,
  tableHead,
  tableHeader,
  tableRow,
  tableWrapper,
} from '../styles'

const props = defineProps<{ id: string }>()
const id = toRef(props, 'id')

const { data, isPending, isError } = useQuery({
  queryKey: ['notebook', id],
  queryFn: () => fetchNotebook(id.value),
})

const crumbs = computed(() =>
  data.value
    ? [
        { label: 'Projects', to: '/' },
        { label: data.value.project.code, to: `/projects/${data.value.project.code}`, mono: true },
        { label: data.value.notebook.title },
      ]
    : [{ label: 'Projects', to: '/' }],
)
</script>

<template>
  <BreadcrumbTrail :items="crumbs" />
  <QueryStatus :pending="isPending" :failed="isError" :missing="data === null" what="notebook">
    <template v-if="data">
      <PageTitle :icon="NotebookIcon">{{ data.notebook.title }}</PageTitle>
      <p class="mt-2 max-w-prose text-muted">
        <template v-if="data.notebook.description">{{ data.notebook.description }} </template>
        Kept by {{ data.notebook.owner.name }}.
      </p>

      <h2 :class="sectionHeading" class="mt-8 mb-3">Entries</h2>
      <p v-if="data.entries.length === 0" class="text-muted">No entries yet.</p>
      <div v-else :class="tableWrapper">
        <table :class="table">
          <thead :class="tableHead">
            <tr>
              <th scope="col" :class="tableHeader">Code</th>
              <th scope="col" :class="tableHeader">Entry</th>
              <th scope="col" :class="tableHeader" class="max-md:hidden">Kind</th>
              <th scope="col" :class="tableHeader">Status</th>
              <th scope="col" :class="tableHeader" class="max-lg:hidden">Author</th>
              <th scope="col" :class="tableHeader" class="max-lg:hidden">Versions</th>
              <th scope="col" :class="tableHeader" class="max-sm:hidden">Last saved</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr v-for="entry in data.entries" :key="entry.code" :class="tableRow">
              <td :class="tableCell" class="font-mono whitespace-nowrap">{{ entry.code }}</td>
              <td :class="tableCell">
                <RouterLink :to="`/entries/${entry.code}`" :class="rowLink">
                  {{ entry.title }}
                </RouterLink>
              </td>
              <td :class="tableCell" class="max-md:hidden">{{ KIND_LABELS[entry.kind] }}</td>
              <td :class="tableCell">
                <span :class="badge">{{ STATUS_LABELS[entry.status] }}</span>
              </td>
              <td :class="tableCell" class="max-lg:hidden">{{ entry.author.name }}</td>
              <td :class="tableCell" class="max-lg:hidden">{{ entry.latestVersion }}</td>
              <td :class="tableCell" class="whitespace-nowrap max-sm:hidden">
                {{ formatDateTime(entry.updatedAt) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </QueryStatus>
</template>
