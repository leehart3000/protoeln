<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { toRef } from 'vue'

import { fetchProject } from '../api'
import BreadcrumbTrail from '../components/BreadcrumbTrail.vue'
import NewButton from '../components/NewButton.vue'
import NotebookTable from '../components/NotebookTable.vue'
import PageTitle from '../components/PageTitle.vue'
import QueryStatus from '../components/QueryStatus.vue'
import { ProjectIcon } from '../icons'
import { sectionHeading } from '../styles'

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
      { label: 'Projects', to: '/projects' },
      { label: code, mono: true },
    ]"
  />
  <QueryStatus :pending="isPending" :failed="isError" :missing="data === null" what="project">
    <template v-if="data">
      <PageTitle :icon="ProjectIcon">{{ data.project.title }}</PageTitle>
      <p v-if="data.project.description" class="mt-2 max-w-2xl text-muted">
        {{ data.project.description }}
      </p>

      <div class="mt-8 mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 :class="sectionHeading">Notebooks</h2>
        <NewButton v-if="data.project.canContribute" :to="`/projects/${code}/notebooks/new`">
          New notebook
        </NewButton>
      </div>
      <p v-if="data.notebooks.length === 0" class="text-muted">No notebooks yet.</p>
      <NotebookTable v-else :notebooks="data.notebooks" />
    </template>
  </QueryStatus>
</template>
