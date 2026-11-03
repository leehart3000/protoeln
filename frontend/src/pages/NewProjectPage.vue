<script setup lang="ts">
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { createProject, fieldProblems } from '../api'
import BreadcrumbTrail from '../components/BreadcrumbTrail.vue'
import FormProblem from '../components/FormProblem.vue'
import PageTitle from '../components/PageTitle.vue'
import { ProjectIcon } from '../icons'
import {
  fieldHint,
  fieldLabel,
  fieldProblem,
  inputClass,
  primaryButton,
  secondaryButton,
} from '../styles'
import { useMe } from '../useMe'

// Creating a project, for site admins (as in ProtoLIMS). Its creator becomes its project admin.

const me = useMe()
const router = useRouter()
const queryClient = useQueryClient()

const code = ref('')
const title = ref('')
const description = ref('')
const publicRead = ref(false)

const creating = useMutation({
  mutationFn: () =>
    createProject({
      code: code.value,
      title: title.value,
      description: description.value,
      publicRead: publicRead.value,
    }),
  onSuccess: async (project) => {
    await queryClient.invalidateQueries({ queryKey: ['projects'] })
    await router.push(`/projects/${project.code}`)
  },
})
const problems = computed(() => fieldProblems(creating.error.value))
</script>

<template>
  <BreadcrumbTrail :items="[{ label: 'Projects', to: '/projects' }, { label: 'New project' }]" />
  <PageTitle :icon="ProjectIcon">New project</PageTitle>
  <p v-if="me.isPending.value" class="mt-3 text-muted">Loading…</p>
  <p v-else-if="!me.data.value?.user?.siteAdmin" class="mt-3 max-w-2xl text-muted">
    Only site admins can create projects.
  </p>
  <form v-else class="mt-6 max-w-2xl space-y-5" novalidate @submit.prevent="creating.mutate()">
    <FormProblem :error="creating.error.value" />
    <div>
      <label for="code" :class="fieldLabel">Code</label>
      <p id="code-hint" :class="fieldHint">
        2 to 10 capital letters and digits, starting with a letter, such as LAB or ONC2. It's used
        in addresses, so it can't be changed later.
      </p>
      <input
        id="code"
        v-model="code"
        required
        autocomplete="off"
        aria-describedby="code-hint code-problem"
        :aria-invalid="problems.code ? true : undefined"
        :class="[inputClass, problems.code ? 'border-danger' : 'border-line']"
        class="font-mono"
      />
      <p v-if="problems.code" id="code-problem" :class="fieldProblem">
        The code {{ problems.code }}.
      </p>
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
          Anyone can read it, without signing in. Only its members can add to it.
        </span>
      </span>
    </label>
    <div class="flex flex-wrap items-center gap-3">
      <button type="submit" :class="primaryButton" :disabled="creating.isPending.value">
        {{ creating.isPending.value ? 'Creating…' : 'Create project' }}
      </button>
      <RouterLink to="/projects" :class="secondaryButton">Cancel</RouterLink>
    </div>
  </form>
</template>
