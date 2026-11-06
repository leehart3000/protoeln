<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref, toRef, watch } from 'vue'
import { useRouter } from 'vue-router'

import { fetchProject, fieldProblems, updateProject, type Project } from '../api'
import BreadcrumbTrail from '../components/BreadcrumbTrail.vue'
import FormProblem from '../components/FormProblem.vue'
import PageTitle from '../components/PageTitle.vue'
import QueryStatus from '../components/QueryStatus.vue'
import { ProjectIcon } from '../icons'
import { READ_ONLY_REASON } from '../permissions'
import { fieldLabel, fieldProblem, inputClass, primaryButton, secondaryButton } from '../styles'
import { useMe } from '../useMe'

// Changing a project's title, description and whether it's public, for its admins and site
// admins (as ProtoLIMS's EditProjectPage). Its code never changes. Only the details changed
// are sent, and each change is recorded with who made it and when.

const props = defineProps<{ code: string }>()
const code = toRef(props, 'code')
const projectPath = computed(() => `/projects/${code.value}`)

const me = useMe()
const router = useRouter()
const queryClient = useQueryClient()
const { data, isPending, isError } = useQuery({
  queryKey: ['project', code],
  queryFn: () => fetchProject(code.value),
})

const title = ref('')
const description = ref('')
const publicRead = ref(false)

// The form starts with the project's details as they are, once they've loaded
const initial = ref<Project | null>(null)
watch(
  () => data.value?.project,
  (project) => {
    if (project && initial.value === null) {
      initial.value = project
      title.value = project.title
      description.value = project.description
      publicRead.value = project.publicRead
    }
  },
  { immediate: true },
)

function changedDetails(project: Project) {
  return {
    ...(title.value !== project.title && { title: title.value }),
    ...(description.value !== project.description && { description: description.value }),
    ...(publicRead.value !== project.publicRead && { publicRead: publicRead.value }),
  }
}

const saving = useMutation({
  mutationFn: () => updateProject(code.value, changedDetails(initial.value!)),
  onSuccess: async () => {
    // Its title shows on many pages, so everything is fetched again
    await queryClient.invalidateQueries()
    await router.push(projectPath.value)
  },
})
const problems = computed(() => fieldProblems(saving.error.value))
</script>

<template>
  <BreadcrumbTrail
    :items="[
      { label: 'Projects', to: '/projects' },
      { label: code, to: projectPath, mono: true },
      { label: 'Edit' },
    ]"
  />
  <QueryStatus :pending="isPending" :failed="isError" :missing="data === null" what="project">
    <template v-if="data">
      <PageTitle :icon="ProjectIcon">Edit project</PageTitle>
      <p v-if="me.data.value?.readOnly" class="mt-3 max-w-2xl text-muted">
        {{ READ_ONLY_REASON }}
      </p>
      <p v-else-if="!data.project.canManageMembers" class="mt-3 max-w-2xl text-muted">
        Only the project's admins can change its details.
      </p>
      <form v-else class="mt-6 max-w-2xl space-y-5" novalidate @submit.prevent="saving.mutate()">
        <FormProblem :error="saving.error.value" />
        <div>
          <p :class="fieldLabel">Code</p>
          <p class="mt-1.5 font-mono">{{ data.project.code }}</p>
          <p class="mt-1 text-sm text-muted">It's used in addresses, so it can't be changed.</p>
        </div>
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
        <label class="flex items-start gap-3">
          <input v-model="publicRead" type="checkbox" class="mt-1 size-4 accent-primary" />
          <span>
            <span class="font-medium">Public</span>
            <span class="block text-sm text-muted">
              Anyone can read it, without signing in. Only its contributors and admins can add to
              it.
              <template v-if="me.data.value?.publicRead === false">
                This site doesn't show public projects to everyone at the moment, so only its
                members will see it until it does.
              </template>
            </span>
          </span>
        </label>
        <div class="flex flex-wrap items-center gap-3">
          <button type="submit" :class="primaryButton" :disabled="saving.isPending.value">
            {{ saving.isPending.value ? 'Saving…' : 'Save changes' }}
          </button>
          <RouterLink :to="projectPath" :class="secondaryButton">Cancel</RouterLink>
        </div>
      </form>
    </template>
  </QueryStatus>
</template>
