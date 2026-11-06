<script setup lang="ts">
import type { Notebook, ProjectRef } from '../api'
import { formatDateTime } from '../format'
import {
  rowLink,
  table,
  tableCell,
  tableHead,
  tableHeader,
  tableRow,
  tableWrapper,
} from '../styles'
import RowDetails from './RowDetails.vue'

// A table of notebooks, each row linking to its notebook. With `showProject` (in the list of
// every notebook), it also says which project each is in.
defineProps<{ notebooks: (Notebook & { project?: ProjectRef })[]; showProject?: boolean }>()
</script>

<template>
  <div :class="tableWrapper">
    <table :class="table">
      <thead :class="tableHead">
        <tr>
          <th scope="col" :class="tableHeader">Notebook</th>
          <th v-if="showProject" scope="col" :class="tableHeader" class="max-md:hidden">Project</th>
          <th v-else scope="col" :class="tableHeader" class="max-md:hidden">Description</th>
          <th scope="col" :class="tableHeader" class="max-sm:hidden">Owner</th>
          <th scope="col" :class="tableHeader" class="max-lg:hidden">Last changed</th>
          <th :class="tableHeader" aria-hidden="true"></th>
        </tr>
      </thead>
      <tbody class="divide-y divide-line">
        <tr v-for="notebook in notebooks" :key="notebook.id" :class="tableRow">
          <td :class="tableCell">
            <RouterLink :to="`/notebooks/${notebook.id}`" :class="rowLink">
              {{ notebook.title }}
            </RouterLink>
            <!-- Its project, under its title when there's no room for the Project column -->
            <p v-if="showProject" class="mt-1 font-mono text-xs text-muted md:hidden">
              {{ notebook.project?.code }}
            </p>
          </td>
          <td v-if="showProject" :class="tableCell" class="max-md:hidden">
            <span class="font-mono">{{ notebook.project?.code }}</span>
          </td>
          <td v-else :class="tableCell" class="text-muted max-md:hidden">
            {{ notebook.description }}
          </td>
          <td :class="tableCell" class="max-sm:hidden">{{ notebook.owner.name }}</td>
          <td :class="tableCell" class="whitespace-nowrap max-lg:hidden">
            {{ formatDateTime(notebook.updatedAt) }}
          </td>
          <RowDetails />
        </tr>
      </tbody>
    </table>
  </div>
</template>
