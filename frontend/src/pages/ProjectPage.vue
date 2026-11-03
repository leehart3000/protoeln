<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { toRef } from 'vue'

import { fetchProject } from '../api'
import BreadcrumbTrail from '../components/BreadcrumbTrail.vue'
import PageTitle from '../components/PageTitle.vue'
import QueryStatus from '../components/QueryStatus.vue'
import { formatDateTime } from '../format'
import { ProjectIcon } from '../icons'
import {
  rowLink,
  sectionHeading,
  table,
  tableCell,
  tableHead,
  tableHeader,
  tableRow,
  tableWrapper,
} from '../styles'

const props = defineProps<{ code: string }>()
const code = toRef(props, 'code')

const { data, isPending, isError } = useQuery({
  queryKey: ['project', code],
  queryFn: () => fetchProject(code.value),
})
</script>

<template>
  <BreadcrumbTrail
    :items="[
      { label: 'Projects', to: '/' },
      { label: code, mono: true },
    ]"
  />
  <QueryStatus :pending="isPending" :failed="isError" :missing="data === null" what="project">
    <template v-if="data">
      <PageTitle :icon="ProjectIcon">{{ data.project.title }}</PageTitle>
      <p v-if="data.project.description" class="mt-2 max-w-prose text-muted">
        {{ data.project.description }}
      </p>

      <h2 :class="sectionHeading" class="mt-8 mb-3">Notebooks</h2>
      <p v-if="data.notebooks.length === 0" class="text-muted">No notebooks yet.</p>
      <div v-else :class="tableWrapper">
        <table :class="table">
          <thead :class="tableHead">
            <tr>
              <th scope="col" :class="tableHeader">Notebook</th>
              <th scope="col" :class="tableHeader" class="max-md:hidden">Description</th>
              <th scope="col" :class="tableHeader">Owner</th>
              <th scope="col" :class="tableHeader" class="max-sm:hidden">Last changed</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr v-for="notebook in data.notebooks" :key="notebook.id" :class="tableRow">
              <td :class="tableCell">
                <RouterLink :to="`/notebooks/${notebook.id}`" :class="rowLink">
                  {{ notebook.title }}
                </RouterLink>
              </td>
              <td :class="tableCell" class="text-muted max-md:hidden">
                {{ notebook.description }}
              </td>
              <td :class="tableCell">{{ notebook.owner.name }}</td>
              <td :class="tableCell" class="whitespace-nowrap max-sm:hidden">
                {{ formatDateTime(notebook.updatedAt) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </QueryStatus>
</template>
