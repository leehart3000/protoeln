<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed, toRef } from 'vue'

import { fetchProject } from '../api'
import { ROLE_LABELS } from '../format'
import BreadcrumbTrail from '../components/BreadcrumbTrail.vue'
import EditLink from '../components/EditLink.vue'
import MembersSection from '../components/MembersSection.vue'
import NewButton from '../components/NewButton.vue'
import NotebookTable from '../components/NotebookTable.vue'
import PageTitle from '../components/PageTitle.vue'
import QueryStatus from '../components/QueryStatus.vue'
import { ProjectIcon } from '../icons'
import { readableByAnyone, refusal } from '../permissions'
import { badge, sectionHeading } from '../styles'
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

// Who can see the project, and why (a project marked public is only public if the site shows
// public projects to everyone)
const visibility = computed(() => {
  const project = data.value?.project
  if (!project) return null
  if (readableByAnyone(project, me.data.value)) {
    return { label: 'Public', text: 'Anyone can read it, without signing in.' }
  }
  return {
    label: 'Private',
    text: project.publicRead
      ? "Only its members can see it. It's marked public, but this site doesn't show public projects to everyone at the moment."
      : 'Only its members can see it.',
  }
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
      <!-- Its admins and site admins can change its details -->
      <div class="flex flex-wrap items-start justify-between gap-3">
        <PageTitle :icon="ProjectIcon">{{ data.project.title }}</PageTitle>
        <EditLink
          v-if="data.project.canManageMembers"
          :to="`/projects/${code}/edit`"
          label="Edit project"
          :read-only="me.data.value?.readOnly === true"
        />
      </div>
      <p v-if="data.project.description" class="mt-2 max-w-2xl text-muted">
        {{ data.project.description }}
      </p>
      <p v-if="visibility" class="mt-3 max-w-2xl text-sm text-muted">
        <span :class="badge" class="mr-1.5 text-fg">{{ visibility.label }}</span>
        {{ visibility.text }}
        <template v-if="data.project.yourRole">
          Your role: {{ ROLE_LABELS[data.project.yourRole] }}.
        </template>
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
      <!-- Hidden while the site is read-only, as no one could change anything in it -->
      <MembersSection
        v-if="data.project.canManageMembers && !me.data.value?.readOnly"
        :code="code"
      />
    </template>
  </QueryStatus>
</template>
