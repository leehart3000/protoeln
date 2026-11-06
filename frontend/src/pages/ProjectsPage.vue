<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'

import { fetchProjects } from '../api'
import NewButton from '../components/NewButton.vue'
import PageTitle from '../components/PageTitle.vue'
import QueryStatus from '../components/QueryStatus.vue'
import RowDetails from '../components/RowDetails.vue'
import { ROLE_LABELS } from '../format'
import { ProjectIcon } from '../icons'
import { readableByAnyone, refusal } from '../permissions'
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
const cannotCreate = computed(() =>
  refusal(me.data.value, me.data.value?.user?.siteAdmin === true, 'site admins'),
)
</script>

<template>
  <div class="flex items-center gap-3">
    <PageTitle :icon="ProjectIcon">Projects</PageTitle>
    <NewButton short to="/projects/new" label="New project" :refusal="cannotCreate" />
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
                <!-- The visitor's role in it, if any, and whether anyone can read it -->
                <td :class="tableCell" class="max-sm:hidden">
                  <span class="flex flex-wrap gap-1.5">
                    <span v-if="project.yourRole" :class="badge">
                      {{ ROLE_LABELS[project.yourRole] }}
                    </span>
                    <span v-if="readableByAnyone(project, me.data.value)" :class="badge">
                      Public
                    </span>
                  </span>
                </td>
                <RowDetails />
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </QueryStatus>
    <p class="mt-4">
      <NewButton to="/projects/new" label="New project" :refusal="cannotCreate" align="start" />
    </p>
  </div>
</template>
