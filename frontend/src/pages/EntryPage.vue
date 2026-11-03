<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed, toRef } from 'vue'

import { fetchEntry, fetchHistoryCheck, fetchVersions } from '../api'
import BreadcrumbTrail from '../components/BreadcrumbTrail.vue'
import ContentBlocks from '../components/ContentBlocks.vue'
import PageTitle from '../components/PageTitle.vue'
import QueryStatus from '../components/QueryStatus.vue'
import { formatDateTime, KIND_LABELS, STATUS_LABELS } from '../format'
import { HistoryIntactIcon, HistoryProblemIcon } from '../icons'
import { KIND_ICONS } from '../kinds'
import {
  badge,
  errorBox,
  sectionHeading,
  table,
  tableCell,
  tableHead,
  tableHeader,
  tableWrapper,
} from '../styles'

// One entry, for reading: its details, its current draft, and its versions, with a check that
// none of the versions has been changed since it was made

const props = defineProps<{ code: string }>()
const code = toRef(props, 'code')

const { data, isPending, isError } = useQuery({
  queryKey: ['entry', code],
  queryFn: () => fetchEntry(code.value),
})
const versions = useQuery({
  queryKey: ['entry', code, 'versions'],
  queryFn: () => fetchVersions(code.value),
})
const historyCheck = useQuery({
  queryKey: ['entry', code, 'history-check'],
  queryFn: () => fetchHistoryCheck(code.value),
})

const crumbs = computed(() =>
  data.value
    ? [
        { label: 'Projects', to: '/projects' },
        { label: data.value.project.code, to: `/projects/${data.value.project.code}`, mono: true },
        { label: data.value.notebook.title, to: `/notebooks/${data.value.notebook.id}` },
        { label: data.value.entry.code, mono: true },
      ]
    : [{ label: 'Projects', to: '/projects' }],
)
</script>

<template>
  <BreadcrumbTrail :items="crumbs" />
  <QueryStatus :pending="isPending" :failed="isError" :missing="data === null" what="entry">
    <template v-if="data">
      <PageTitle :icon="KIND_ICONS[data.entry.kind]">{{ data.entry.title }}</PageTitle>
      <dl class="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt class="text-muted">Code</dt>
        <dd class="font-mono">{{ data.entry.code }}</dd>
        <dt class="text-muted">Kind</dt>
        <dd>{{ KIND_LABELS[data.entry.kind] }}</dd>
        <dt class="text-muted">Status</dt>
        <dd>
          <span :class="badge">{{ STATUS_LABELS[data.entry.status] }}</span>
        </dd>
        <dt class="text-muted">Author</dt>
        <dd>{{ data.entry.author.name }}</dd>
        <template v-if="data.entry.coAuthors.length > 0">
          <dt class="text-muted">Co-authors</dt>
          <dd>{{ data.entry.coAuthors.map((person) => person.name).join(', ') }}</dd>
        </template>
        <dt class="text-muted">Last saved</dt>
        <dd>{{ formatDateTime(data.entry.updatedAt) }}</dd>
      </dl>

      <section aria-labelledby="draft-heading" class="mt-8">
        <h2 id="draft-heading" :class="sectionHeading">Current draft</h2>
        <div class="mt-3 max-w-3xl space-y-3 rounded-lg border border-line bg-panel p-4 sm:p-6">
          <ContentBlocks
            v-if="data.entry.content.content.length > 0"
            :blocks="data.entry.content.content"
          />
          <p v-else class="text-muted">This entry is empty.</p>
        </div>
      </section>

      <section aria-labelledby="versions-heading" class="mt-8">
        <h2 id="versions-heading" :class="sectionHeading">Versions</h2>
        <p class="mt-1 max-w-2xl text-sm text-muted">
          A version is a fixed, numbered copy of the entry. Each has a fingerprint (a SHA-256 hash,
          shortened here) that includes the fingerprint of the version before, so any later change
          would show.
        </p>
        <div class="mt-3">
          <QueryStatus
            :pending="versions.isPending.value"
            :failed="versions.isError.value"
            what="versions"
          >
            <template v-if="versions.data.value">
              <p v-if="versions.data.value.length === 0" class="text-muted">No versions yet.</p>
              <template v-else>
                <p
                  v-if="historyCheck.data.value?.intact"
                  class="mb-3 flex items-center gap-2 font-medium"
                >
                  <HistoryIntactIcon aria-hidden="true" class="size-5 shrink-0 text-primary" />
                  The history checks out: every version still matches its fingerprint.
                </p>
                <div
                  v-else-if="historyCheck.data.value"
                  role="alert"
                  :class="errorBox"
                  class="mb-3"
                >
                  <p class="flex items-center gap-2">
                    <HistoryProblemIcon aria-hidden="true" class="size-5 shrink-0" />
                    The history doesn't check out:
                  </p>
                  <ul class="mt-1 list-disc pl-10 font-normal">
                    <li v-for="problem in historyCheck.data.value.problems" :key="problem">
                      {{ problem }}
                    </li>
                  </ul>
                </div>
                <div :class="tableWrapper">
                  <table :class="table">
                    <thead :class="tableHead">
                      <tr>
                        <th scope="col" :class="tableHeader">Version</th>
                        <th scope="col" :class="tableHeader">Note</th>
                        <th scope="col" :class="tableHeader" class="max-md:hidden">Made by</th>
                        <th scope="col" :class="tableHeader">Made</th>
                        <th scope="col" :class="tableHeader">Fingerprint</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-line">
                      <tr v-for="version in versions.data.value" :key="version.number">
                        <td :class="tableCell">{{ version.number }}</td>
                        <td :class="tableCell">{{ version.note }}</td>
                        <td :class="tableCell" class="max-md:hidden">
                          {{ version.createdBy.name }}
                        </td>
                        <td :class="tableCell" class="whitespace-nowrap">
                          {{ formatDateTime(version.createdAt) }}
                        </td>
                        <!-- The first 7 characters, like git's short commit ids: enough to
                             tell versions apart. The whole hash shows on hover. -->
                        <td :class="tableCell" class="font-mono">
                          <span :title="version.hash">{{ version.hash.slice(0, 7) }}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </template>
            </template>
          </QueryStatus>
        </div>
      </section>
    </template>
  </QueryStatus>
</template>
