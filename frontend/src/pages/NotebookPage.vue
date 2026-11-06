<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed, toRef } from 'vue'

import { fetchNotebook } from '../api'
import { formatDate } from '../format'
import BreadcrumbTrail from '../components/BreadcrumbTrail.vue'
import DetailsCard from '../components/DetailsCard.vue'
import EntryTable from '../components/EntryTable.vue'
import LinkedText from '../components/LinkedText.vue'
import NewButton from '../components/NewButton.vue'
import PageTitle from '../components/PageTitle.vue'
import QueryStatus from '../components/QueryStatus.vue'
import { NotebookIcon } from '../icons'
import { refusal } from '../permissions'
import { detailList, detailTerm, detailValue, sectionHeading, textLink } from '../styles'
import { useMe } from '../useMe'

const props = defineProps<{ id: string }>()
const id = toRef(props, 'id')

const { data, isPending, isError } = useQuery({
  queryKey: ['notebook', id],
  queryFn: () => fetchNotebook(id.value),
})

const me = useMe()
const cannotAdd = computed(() =>
  refusal(
    me.data.value,
    data.value?.project.canContribute === true,
    "the project's contributors and admins",
  ),
)

const crumbs = computed(() =>
  data.value
    ? [
        { label: 'Projects', to: '/projects' },
        { label: data.value.project.code, to: `/projects/${data.value.project.code}`, mono: true },
        { label: data.value.notebook.title },
      ]
    : [{ label: 'Projects', to: '/projects' }],
)
</script>

<template>
  <BreadcrumbTrail :items="crumbs" />
  <QueryStatus :pending="isPending" :failed="isError" :missing="data === null" what="notebook">
    <template v-if="data">
      <PageTitle :icon="NotebookIcon">{{ data.notebook.title }}</PageTitle>
      <!-- Its owner, the project's admins and site admins can change these -->
      <DetailsCard
        :edit-to="`/notebooks/${id}/edit`"
        edit-label="Edit notebook"
        :can-edit="data.notebook.canEdit === true"
        :read-only="me.data.value?.readOnly === true"
      >
        <p v-if="data.notebook.description" class="mt-3 max-w-3xl text-muted">
          <LinkedText :text="data.notebook.description" />
        </p>
        <dl :class="detailList">
          <dt :class="detailTerm">Project:</dt>
          <dd :class="detailValue">
            <RouterLink :to="`/projects/${data.project.code}`" :class="textLink">{{
              data.project.title
            }}</RouterLink>
          </dd>
          <dt :class="detailTerm">Kept by:</dt>
          <dd :class="detailValue">{{ data.notebook.owner.name }}</dd>
          <dt :class="detailTerm">Created:</dt>
          <dd :class="detailValue">{{ formatDate(data.notebook.createdAt) }}</dd>
        </dl>
      </DetailsCard>

      <div class="mt-8 mb-3 flex items-center gap-3">
        <h2 :class="sectionHeading">Entries</h2>
        <NewButton
          short
          :to="`/notebooks/${id}/entries/new`"
          label="New entry"
          :refusal="cannotAdd"
        />
      </div>
      <p v-if="data.entries.length === 0" class="text-muted">No entries yet.</p>
      <EntryTable v-else :entries="data.entries" />
      <p class="mt-4">
        <NewButton
          :to="`/notebooks/${id}/entries/new`"
          label="New entry"
          :refusal="cannotAdd"
          align="start"
        />
      </p>
    </template>
  </QueryStatus>
</template>
