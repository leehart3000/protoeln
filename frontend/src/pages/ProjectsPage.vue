<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'

import { fetchProjects, type Project } from '../api'
import NewButton from '../components/NewButton.vue'
import PageTitle from '../components/PageTitle.vue'
import QueryStatus from '../components/QueryStatus.vue'
import RowDetails from '../components/RowDetails.vue'
import { ROLE_LABELS } from '../format'
import { ProjectIcon } from '../icons'
import { useMe } from '../useMe'
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

// Every project the visitor can read: their own, and any that are public
const me = useMe()
const { data, isPending, isError } = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })

function access(project: Project) {
  if (project.yourRole) return ROLE_LABELS[project.yourRole]
  return project.publicRead ? 'Public' : ''
}
</script>

<template>
  <div class="flex flex-wrap items-start justify-between gap-3">
    <PageTitle :icon="ProjectIcon">Projects</PageTitle>
    <NewButton v-if="me.data.value?.user?.siteAdmin" to="/projects/new">New project</NewButton>
  </div>
  <div class="mt-6">
    <QueryStatus :pending="isPending" :failed="isError" what="projects">
      <template v-if="data">
        <p v-if="data.length === 0" class="text-muted">
          There are no projects you can see yet. Sign in to see your own.
        </p>
        <div v-else :class="tableWrapper">
          <table :class="table">
            <thead :class="tableHead">
              <tr>
                <th scope="col" :class="tableHeader">Code</th>
                <th scope="col" :class="tableHeader">Project</th>
                <th scope="col" :class="tableHeader" class="max-md:hidden">Description</th>
                <th scope="col" :class="tableHeader" class="max-sm:hidden">Access</th>
                <th :class="tableHeader" aria-hidden="true"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-line">
              <tr v-for="project in data" :key="project.code" :class="tableRow">
                <td :class="tableCell" class="font-mono whitespace-nowrap">{{ project.code }}</td>
                <td :class="tableCell">
                  <RouterLink :to="`/projects/${project.code}`" :class="rowLink">
                    {{ project.title }}
                  </RouterLink>
                </td>
                <td :class="tableCell" class="text-muted max-md:hidden">
                  {{ project.description }}
                </td>
                <td :class="tableCell" class="max-sm:hidden">
                  <span v-if="access(project)" :class="badge">{{ access(project) }}</span>
                </td>
                <RowDetails />
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </QueryStatus>
  </div>
</template>
