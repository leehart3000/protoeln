<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, defineAsyncComponent, h, ref, toRef } from 'vue'

import {
  fetchEntry,
  fetchHistoryCheck,
  fetchLinkedFrom,
  fetchVersions,
  tickStep,
  type LinkingEntry,
} from '../api'
import BreadcrumbTrail from '../components/BreadcrumbTrail.vue'
import DisabledButton from '../components/DisabledButton.vue'
import ContentBlocks from '../components/ContentBlocks.vue'
import FormProblem from '../components/FormProblem.vue'
import PageTitle from '../components/PageTitle.vue'
import QueryStatus from '../components/QueryStatus.vue'
import RowDetails from '../components/RowDetails.vue'
import VersionForm from '../components/VersionForm.vue'
import { formatDateTime, KIND_LABELS, STATUS_LABELS } from '../format'
import { EditIcon, HistoryIntactIcon, HistoryProblemIcon, LoadingIcon, VersionIcon } from '../icons'
import { KIND_ICONS } from '../kinds'
import { READ_ONLY_REASON } from '../permissions'
import {
  badge,
  errorBox,
  rowLink,
  secondaryButton,
  sectionHeading,
  table,
  tableCell,
  tableHead,
  tableHeader,
  tableRow,
  tableWrapper,
  textLink,
} from '../styles'
import { useMe } from '../useMe'

// One entry: its details, its current draft, and its versions, with a check that none of the
// versions has been changed since it was made. Its author can edit the draft (in the editor),
// tick off protocol steps (each tick is saved straight away), and create versions.

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
const linkedFrom = useQuery({
  queryKey: ['entry', code, 'linked-from'],
  queryFn: () => fetchLinkedFrom(code.value),
})
// Where another entry's link to this one is, such as "In version 1" or "In its current draft
// and versions 1 and 2". (The entry's own status, such as Draft or Signed, is something else.)
function whereLinked({ draft, versions }: LinkingEntry['linkedIn']) {
  const places = draft ? ['its current draft'] : []
  if (versions.length === 1) places.push(`version ${versions[0]}`)
  if (versions.length > 1) {
    places.push(`versions ${versions.slice(0, -1).join(', ')} and ${versions.at(-1)}`)
  }
  return `In ${places.join(' and ')}`
}

// While the site is read-only, its author sees Edit and Create version greyed out, with why,
// and steps can't be ticked
const me = useMe()
const readOnly = computed(() => me.data.value?.readOnly === true)

const historyCheck = useQuery({
  queryKey: ['entry', code, 'history-check'],
  queryFn: () => fetchHistoryCheck(code.value),
})

// Ticking a step saves it at once. If the draft has changed since this page loaded, the tick is
// refused and the page fetches the draft again, so the next tick is of the steps as they are.
const queryClient = useQueryClient()
const ticking = useMutation({
  mutationFn: (step: { path: number[]; done: boolean }) =>
    tickStep(code.value, { basedOn: data.value?.entry.updatedAt ?? '', ...step }),
  onSuccess: async (result) => {
    queryClient.setQueryData(['entry', code.value], (old: unknown) =>
      old && typeof old === 'object' ? { ...old, entry: result.entry } : old,
    )
    await queryClient.invalidateQueries({
      predicate: (query) => ['entries', 'notebook'].includes(String(query.queryKey[0])),
    })
  },
  onError: () => queryClient.invalidateQueries({ queryKey: ['entry', code.value], exact: true }),
})

function tick(path: number[], done: boolean) {
  ticking.mutate({ path, done })
}

// The editor is loaded only when someone opens it, as it's most of the website's code and most
// visitors only read. If that takes more than a moment, a message says so; if it fails (say,
// the connection dropped), another says what to do.
const EntryEditor = defineAsyncComponent({
  loader: () => import('../components/EntryEditor.vue'),
  delay: 200,
  loadingComponent: {
    render: () =>
      h('p', { role: 'status', class: 'mt-3 flex items-center gap-2 text-muted' }, [
        h(LoadingIcon, { 'aria-hidden': 'true', class: 'size-4 motion-safe:animate-spin' }),
        'Loading the editor…',
      ]),
  },
  errorComponent: {
    render: () =>
      h(
        'p',
        { role: 'alert', class: 'mt-3 font-medium text-danger' },
        "The editor couldn't be loaded. Check your connection, then reload the page.",
      ),
  },
})

// The editor, or the form for a new version, when open (one at a time)
const editing = ref(false)
const versioning = ref(false)

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
        <div class="flex flex-wrap items-center gap-3">
          <h2 id="draft-heading" :class="sectionHeading">Current draft</h2>
          <template v-if="data.entry.canEdit && readOnly">
            <DisabledButton
              :icon="EditIcon"
              :button-class="secondaryButton"
              :reason="READ_ONLY_REASON"
            >
              Edit
            </DisabledButton>
            <DisabledButton
              :icon="VersionIcon"
              :button-class="secondaryButton"
              :reason="READ_ONLY_REASON"
            >
              Create version
            </DisabledButton>
          </template>
          <template v-else-if="data.entry.canEdit && !editing && !versioning">
            <button
              type="button"
              :class="secondaryButton"
              class="inline-flex items-center gap-2"
              @click="editing = true"
            >
              <EditIcon aria-hidden="true" class="size-4 shrink-0" />
              Edit
            </button>
            <button
              type="button"
              :class="secondaryButton"
              class="inline-flex items-center gap-2"
              @click="versioning = true"
            >
              <VersionIcon aria-hidden="true" class="size-4 shrink-0" />
              Create version
            </button>
          </template>
        </div>
        <VersionForm v-if="versioning" :code="data.entry.code" @close="versioning = false" />
        <EntryEditor v-if="editing" :entry="data.entry" @close="editing = false" />
        <div
          v-else
          class="mt-3 max-w-3xl space-y-3 rounded-lg border border-line bg-panel p-4 sm:p-6"
        >
          <FormProblem :error="ticking.error.value" />
          <ContentBlocks
            v-if="data.entry.content.content.length > 0"
            :blocks="data.entry.content.content"
            :people="data.entry.contentPeople"
            :tick="data.entry.canEdit && !readOnly ? tick : undefined"
            :ticking="ticking.isPending.value"
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
                        <th :class="tableHeader" aria-hidden="true"></th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-line">
                      <!-- Each row links to its version's page -->
                      <tr
                        v-for="version in versions.data.value"
                        :key="version.number"
                        :class="tableRow"
                      >
                        <td :class="tableCell">
                          <RouterLink
                            :to="`/entries/${data.entry.code}/versions/${version.number}`"
                            :class="rowLink"
                            :aria-label="`Version ${version.number}`"
                          >
                            {{ version.number }}
                          </RouterLink>
                        </td>
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
                        <RowDetails />
                      </tr>
                    </tbody>
                  </table>
                </div>
              </template>
            </template>
          </QueryStatus>
        </div>
      </section>

      <!-- Shown only when other entries link here -->
      <section
        v-if="linkedFrom.data.value?.length"
        aria-labelledby="linked-from-heading"
        class="mt-8"
      >
        <h2 id="linked-from-heading" :class="sectionHeading">Linked from</h2>
        <p class="mt-1 max-w-2xl text-sm text-muted">
          Entries you can read that link to this one, in their current draft or in a version.
        </p>
        <ul class="mt-3 divide-y divide-line rounded-lg border border-line bg-panel">
          <li v-for="linking in linkedFrom.data.value" :key="linking.code" class="px-4 py-3">
            <RouterLink :to="`/entries/${linking.code}`" :class="textLink" class="font-medium">
              {{ linking.title }}
            </RouterLink>
            {{ ' ' }}<span class="ml-1 font-mono text-sm text-muted">{{ linking.code }}</span>
            <p class="mt-1 text-sm text-muted">
              {{ whereLinked(linking.linkedIn) }} · {{ linking.notebook.title }} ·
              <span class="font-mono">{{ linking.project.code }}</span>
            </p>
          </li>
        </ul>
      </section>
    </template>
  </QueryStatus>
</template>
