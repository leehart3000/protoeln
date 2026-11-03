<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref, toRef, type Component } from 'vue'
import { useRouter } from 'vue-router'

import { createEntry, fetchNotebook, fieldProblems, type EntryKind } from '../api'
import BreadcrumbTrail from '../components/BreadcrumbTrail.vue'
import FormProblem from '../components/FormProblem.vue'
import PageTitle from '../components/PageTitle.vue'
import QueryStatus from '../components/QueryStatus.vue'
import { EntryIcon, ExperimentIcon, NoteIcon, ProtocolIcon } from '../icons'
import { fieldLabel, fieldProblem, inputClass, primaryButton, secondaryButton } from '../styles'

// Creating an entry in a notebook, for members of its project. Its creator is its author, and
// it starts as an empty draft, which opens once it's created.

const props = defineProps<{ id: string }>()
const id = toRef(props, 'id')
const router = useRouter()
const queryClient = useQueryClient()

const KINDS: { value: EntryKind; label: string; hint: string; icon: Component }[] = [
  {
    value: 'experiment',
    label: 'Experiment',
    hint: 'What was done, what happened, and the results',
    icon: ExperimentIcon,
  },
  {
    value: 'protocol',
    label: 'Protocol',
    hint: 'A method, with steps that can be ticked off at the bench',
    icon: ProtocolIcon,
  },
  { value: 'note', label: 'Note', hint: 'Anything else worth recording', icon: NoteIcon },
]

const { data, isPending, isError } = useQuery({
  queryKey: ['notebook', id],
  queryFn: () => fetchNotebook(id.value),
})

const kind = ref<EntryKind>('experiment')
const title = ref('')

const creating = useMutation({
  mutationFn: () => createEntry(id.value, { kind: kind.value, title: title.value }),
  onSuccess: async (entry) => {
    await queryClient.invalidateQueries({ queryKey: ['entries'] })
    await queryClient.invalidateQueries({ queryKey: ['notebook', id.value] })
    await router.push(`/entries/${entry.code}`)
  },
})
const problems = computed(() => fieldProblems(creating.error.value))

const crumbs = computed(() =>
  data.value
    ? [
        { label: 'Projects', to: '/projects' },
        { label: data.value.project.code, to: `/projects/${data.value.project.code}`, mono: true },
        { label: data.value.notebook.title, to: `/notebooks/${id.value}` },
        { label: 'New entry' },
      ]
    : [{ label: 'Projects', to: '/projects' }, { label: 'New entry' }],
)
</script>

<template>
  <BreadcrumbTrail :items="crumbs" />
  <PageTitle :icon="EntryIcon">New entry</PageTitle>
  <div class="mt-3">
    <QueryStatus :pending="isPending" :failed="isError" :missing="data === null" what="notebook">
      <template v-if="data">
        <p v-if="!data.project.canContribute" class="max-w-2xl text-muted">
          Only members of {{ data.project.title }} can add entries to it.
        </p>
        <form
          v-else
          class="mt-3 max-w-2xl space-y-5"
          novalidate
          @submit.prevent="creating.mutate()"
        >
          <p class="text-muted">
            In {{ data.notebook.title }}. You'll be its author, and it starts as an empty draft.
          </p>
          <FormProblem :error="creating.error.value" />
          <fieldset>
            <legend :class="fieldLabel">Kind</legend>
            <div class="mt-1.5 grid gap-2 sm:grid-cols-3">
              <label
                v-for="option in KINDS"
                :key="option.value"
                class="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-panel p-3 has-checked:border-primary"
              >
                <input
                  v-model="kind"
                  type="radio"
                  name="kind"
                  :value="option.value"
                  class="mt-1 size-4 accent-primary"
                />
                <span>
                  <span class="flex items-center gap-1.5 font-medium">
                    <component :is="option.icon" aria-hidden="true" class="size-4 text-primary" />
                    {{ option.label }}
                  </span>
                  <span class="block text-sm text-muted">{{ option.hint }}</span>
                </span>
              </label>
            </div>
          </fieldset>
          <div>
            <label for="title" :class="fieldLabel">Title</label>
            <input
              id="title"
              v-model="title"
              required
              aria-describedby="title-problem"
              :aria-invalid="problems.title ? true : undefined"
              :class="[inputClass, problems.title ? 'border-danger' : 'border-line']"
            />
            <p v-if="problems.title" id="title-problem" :class="fieldProblem">
              The title {{ problems.title }}.
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <button type="submit" :class="primaryButton" :disabled="creating.isPending.value">
              {{ creating.isPending.value ? 'Creating…' : 'Create entry' }}
            </button>
            <RouterLink :to="`/notebooks/${id}`" :class="secondaryButton">Cancel</RouterLink>
          </div>
        </form>
      </template>
    </QueryStatus>
  </div>
</template>
