<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref, toRef, watch } from 'vue'
import { useRouter } from 'vue-router'

import { fetchNotebook, fieldProblems, updateNotebook, type Notebook } from '../api'
import BreadcrumbTrail from '../components/BreadcrumbTrail.vue'
import FormProblem from '../components/FormProblem.vue'
import PageTitle from '../components/PageTitle.vue'
import QueryStatus from '../components/QueryStatus.vue'
import { NotebookIcon } from '../icons'
import { READ_ONLY_REASON } from '../permissions'
import { fieldLabel, fieldProblem, inputClass, primaryButton, secondaryButton } from '../styles'
import { useMe } from '../useMe'

// Changing a notebook's title and description, for its owner (while they can contribute to
// its project), the project's admins and site admins. Only the details changed are sent, and
// each change is recorded with who made it and when.

const props = defineProps<{ id: string }>()
const id = toRef(props, 'id')
const notebookPath = computed(() => `/notebooks/${id.value}`)

const me = useMe()
const router = useRouter()
const queryClient = useQueryClient()
const { data, isPending, isError } = useQuery({
  queryKey: ['notebook', id],
  queryFn: () => fetchNotebook(id.value),
})

const title = ref('')
const description = ref('')

// The form starts with the notebook's details as they are, once they've loaded
const initial = ref<Notebook | null>(null)
watch(
  () => data.value?.notebook,
  (notebook) => {
    if (notebook && initial.value === null) {
      initial.value = notebook
      title.value = notebook.title
      description.value = notebook.description
    }
  },
  { immediate: true },
)

function changedDetails(notebook: Notebook) {
  return {
    ...(title.value !== notebook.title && { title: title.value }),
    ...(description.value !== notebook.description && { description: description.value }),
  }
}

const saving = useMutation({
  mutationFn: () => updateNotebook(id.value, changedDetails(initial.value!)),
  onSuccess: async () => {
    // Its title shows on many pages, so everything is fetched again
    await queryClient.invalidateQueries()
    await router.push(notebookPath.value)
  },
})
const problems = computed(() => fieldProblems(saving.error.value))

const crumbs = computed(() =>
  data.value
    ? [
        { label: 'Projects', to: '/projects' },
        { label: data.value.project.code, to: `/projects/${data.value.project.code}`, mono: true },
        { label: data.value.notebook.title, to: notebookPath.value },
        { label: 'Edit' },
      ]
    : [{ label: 'Projects', to: '/projects' }],
)
</script>

<template>
  <BreadcrumbTrail :items="crumbs" />
  <QueryStatus :pending="isPending" :failed="isError" :missing="data === null" what="notebook">
    <template v-if="data">
      <PageTitle :icon="NotebookIcon">Edit notebook</PageTitle>
      <p v-if="me.data.value?.readOnly" class="mt-3 max-w-2xl text-muted">
        {{ READ_ONLY_REASON }}
      </p>
      <p v-else-if="!data.notebook.canEdit" class="mt-3 max-w-2xl text-muted">
        Only the notebook's owner and the project's admins can change it.
      </p>
      <form v-else class="mt-6 max-w-2xl space-y-5" novalidate @submit.prevent="saving.mutate()">
        <FormProblem :error="saving.error.value" />
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
        <div>
          <label for="description" :class="fieldLabel">
            Description <span class="font-normal text-muted">(optional)</span>
          </label>
          <textarea
            id="description"
            v-model="description"
            rows="3"
            :class="[inputClass, 'border-line']"
          ></textarea>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <button type="submit" :class="primaryButton" :disabled="saving.isPending.value">
            {{ saving.isPending.value ? 'Saving…' : 'Save changes' }}
          </button>
          <RouterLink :to="notebookPath" :class="secondaryButton">Cancel</RouterLink>
        </div>
      </form>
    </template>
  </QueryStatus>
</template>
