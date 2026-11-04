<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed, toRef } from 'vue'

import { fetchProject } from '../api'
import BreadcrumbTrail from '../components/BreadcrumbTrail.vue'
import MembersSection from '../components/MembersSection.vue'
import NewButton from '../components/NewButton.vue'
import NotebookTable from '../components/NotebookTable.vue'
import PageTitle from '../components/PageTitle.vue'
import QueryStatus from '../components/QueryStatus.vue'
import { ProjectIcon } from '../icons'
import { refusal } from '../permissions'
import { sectionHeading } from '../styles'
import { useMe } from '../useMe'

const props = defineProps<{ code: string }>()
const code = toRef(props, 'code')

const { data, isPending, isError } = useQuery({
  queryKey: ['project', code],
  queryFn: () => fetchProject(code.value),
})

const me = useMe()
const cannotAdd = computed(() =>
  refusal(
    me.data.value,
    data.value?.project.canContribute === true,
    "the project's contributors and admins",
  ),
)
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

      <div class="mt-8 mb-3 flex items-center gap-3">
        <h2 :class="sectionHeading">Notebooks</h2>
        <NewButton
          short
          :to="`/projects/${code}/notebooks/new`"
          label="New notebook"
          :refusal="cannotAdd"
        />
      </div>
      <p v-if="data.notebooks.length === 0" class="text-muted">No notebooks yet.</p>
      <NotebookTable v-else :notebooks="data.notebooks" />
      <p class="mt-4">
        <NewButton
          :to="`/projects/${code}/notebooks/new`"
          label="New notebook"
          :refusal="cannotAdd"
          align="start"
        />
      </p>
      <MembersSection v-if="data.project.canManageMembers" :code="code" />
    </template>
  </QueryStatus>
</template>
