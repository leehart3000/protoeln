<script setup lang="ts">
import type { EntrySummary, NotebookRef, ProjectRef } from '../api'
import { formatDateTime, KIND_LABELS, STATUS_LABELS } from '../format'
import { KIND_ICONS } from '../kinds'
import {
  badge,
  rowLink,
  table,
  tableCell,
  tableHead,
  tableHeader,
  tableRow,
  tableWrapper,
} from '../styles'
import RowDetails from './RowDetails.vue'

// A table of entries, each row linking to its entry. With `showPlace` (in the list of every
// entry), it also says which project and notebook each is in.
defineProps<{
  entries: (EntrySummary & { notebook?: NotebookRef; project?: ProjectRef })[]
  showPlace?: boolean
}>()
</script>

<template>
  <div :class="tableWrapper">
    <table :class="table">
      <thead :class="tableHead">
        <tr>
          <th scope="col" :class="tableHeader">Code</th>
          <th scope="col" :class="tableHeader">Entry</th>
          <th v-if="showPlace" scope="col" :class="tableHeader" class="max-lg:hidden">Where</th>
          <th scope="col" :class="tableHeader" class="max-md:hidden">Kind</th>
          <th scope="col" :class="tableHeader" class="max-sm:hidden">Status</th>
          <th scope="col" :class="tableHeader" class="max-lg:hidden">Author</th>
          <th scope="col" :class="tableHeader" class="max-xl:hidden">Versions</th>
          <th scope="col" :class="tableHeader" class="max-xl:hidden">Last saved</th>
          <th :class="tableHeader" aria-hidden="true"></th>
        </tr>
      </thead>
      <tbody class="divide-y divide-line">
        <tr v-for="entry in entries" :key="entry.code" :class="tableRow">
          <td :class="tableCell" class="font-mono whitespace-nowrap">{{ entry.code }}</td>
          <td :class="tableCell">
            <RouterLink :to="`/entries/${entry.code}`" :class="rowLink">
              {{ entry.title }}
            </RouterLink>
          </td>
          <td v-if="showPlace" :class="tableCell" class="max-lg:hidden">
            <span class="font-mono">{{ entry.project?.code }}</span> ·
            {{ entry.notebook?.title }}
          </td>
          <td :class="tableCell" class="max-md:hidden">
            <span class="inline-flex items-center gap-1.5 whitespace-nowrap">
              <component
                :is="KIND_ICONS[entry.kind]"
                aria-hidden="true"
                class="size-4 shrink-0 text-primary"
              />
              {{ KIND_LABELS[entry.kind] }}
            </span>
          </td>
          <td :class="tableCell" class="max-sm:hidden">
            <span :class="badge">{{ STATUS_LABELS[entry.status] }}</span>
          </td>
          <td :class="tableCell" class="max-lg:hidden">{{ entry.author.name }}</td>
          <td :class="tableCell" class="max-xl:hidden">{{ entry.latestVersion }}</td>
          <td :class="tableCell" class="whitespace-nowrap max-xl:hidden">
            {{ formatDateTime(entry.updatedAt) }}
          </td>
          <RowDetails />
        </tr>
      </tbody>
    </table>
  </div>
</template>
