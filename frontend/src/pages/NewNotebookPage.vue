<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref, toRef } from 'vue'
import { useRouter } from 'vue-router'

import { createNotebook, fetchProject, fieldProblems } from '../api'
import BreadcrumbTrail from '../components/BreadcrumbTrail.vue'
import FormProblem from '../components/FormProblem.vue'
import PageTitle from '../components/PageTitle.vue'
import QueryStatus from '../components/QueryStatus.vue'
import { NotebookIcon } from '../icons'
import { fieldLabel, fieldProblem, inputClass, primaryButton, secondaryButton } from '../styles'

// Creating a notebook in a project, for its members. Its creator owns it.

const props = defineProps<{ code: string }>()
const code = toRef(props, 'code')
const router = useRouter()
const queryClient = useQueryClient()

const { data, isPending, isError } = useQuery({
  queryKey: ['project', code],
  queryFn: () => fetchProject(code.value),
})

const title = ref('')
const description = ref('')

const creating = useMutation({
  mutationFn: () =>
    createNotebook(code.value, { title: title.value, description: description.value }),
  onSuccess: async (notebook) => {
    await queryClient.invalidateQueries({ queryKey: ['notebooks'] })
    await queryClient.invalidateQueries({ queryKey: ['project', code.value] })
    await router.push(`/notebooks/${notebook.id}`)
  },
})
const problems = computed(() => fieldProblems(creating.error.value))
</script>

<template>
  <BreadcrumbTrail
    :items="[
      { label: 'Projects', to: '/projects' },
      { label: code, to: `/projects/${code}`, mono: true },
      { label: 'New notebook' },
    ]"
  />
  <PageTitle :icon="NotebookIcon">New notebook</PageTitle>
  <div class="mt-3">
    <QueryStatus :pending="isPending" :failed="isError" :missing="data === null" what="project">
      <template v-if="data">
        <p v-if="!data.project.canContribute" class="max-w-2xl text-muted">
          Only members of {{ data.project.title }} can add notebooks to it.
        </p>
        <form
          v-else
          class="mt-3 max-w-2xl space-y-5"
          novalidate
          @submit.prevent="creating.mutate()"
        >
          <p class="text-muted">In {{ data.project.title }}. You'll be its owner.</p>
          <FormProblem :error="creating.error.value" />
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
            <button type="submit" :class="primaryButton" :disabled="creating.isPending.value">
              {{ creating.isPending.value ? 'Creating…' : 'Create notebook' }}
            </button>
            <RouterLink :to="`/projects/${code}`" :class="secondaryButton">Cancel</RouterLink>
          </div>
        </form>
      </template>
    </QueryStatus>
  </div>
</template>
