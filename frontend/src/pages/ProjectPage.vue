<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed, toRef } from 'vue'

import { fetchProject } from '../api'
import { formatDate, ROLE_LABELS } from '../format'
import BreadcrumbTrail from '../components/BreadcrumbTrail.vue'
import DetailsCard from '../components/DetailsCard.vue'
import LinkedText from '../components/LinkedText.vue'
import MembersSection from '../components/MembersSection.vue'
import NewButton from '../components/NewButton.vue'
import NotebookTable from '../components/NotebookTable.vue'
import PageTitle from '../components/PageTitle.vue'
import QueryStatus from '../components/QueryStatus.vue'
import { ProjectIcon } from '../icons'
import { readableByAnyone, refusal } from '../permissions'
import { badge, detailList, detailTerm, detailValue, sectionHeading } from '../styles'
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
      <PageTitle :icon="ProjectIcon">{{ data.project.title }}</PageTitle>
      <!-- Its admins and site admins can change these -->
      <DetailsCard
        :edit-to="`/projects/${code}/edit`"
        edit-label="Edit project"
        :can-edit="data.project.canManageMembers"
        :read-only="me.data.value?.readOnly === true"
      >
        <p v-if="data.project.description" class="mt-3 max-w-3xl text-muted">
          <LinkedText :text="data.project.description" />
        </p>
        <dl :class="detailList">
          <dt :class="detailTerm">Code:</dt>
          <dd :class="detailValue" class="font-mono">{{ data.project.code }}</dd>
          <template v-if="visibility">
            <dt :class="detailTerm">Access:</dt>
            <dd :class="detailValue">
              <span :class="badge" class="mr-1.5">{{ visibility.label }}</span>
              <span class="font-normal text-muted">{{ visibility.text }}</span>
            </dd>
          </template>
          <template v-if="data.project.yourRole">
            <dt :class="detailTerm">Your role:</dt>
            <dd :class="detailValue">{{ ROLE_LABELS[data.project.yourRole] }}</dd>
          </template>
          <!-- Credit for data that comes from elsewhere, if the project gives any -->
          <template v-if="data.project.sourceRepository">
            <dt :class="detailTerm">Source repository:</dt>
            <dd :class="detailValue"><LinkedText :text="data.project.sourceRepository" /></dd>
          </template>
          <template v-if="data.project.licence">
            <dt :class="detailTerm">Licence:</dt>
            <dd :class="detailValue"><LinkedText :text="data.project.licence" /></dd>
          </template>
          <template v-if="data.project.citation">
            <dt :class="detailTerm">Citation:</dt>
            <dd :class="detailValue"><LinkedText :text="data.project.citation" /></dd>
          </template>
          <dt :class="detailTerm">Created:</dt>
          <dd :class="detailValue">{{ formatDate(data.project.createdAt) }}</dd>
        </dl>
      </DetailsCard>

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
