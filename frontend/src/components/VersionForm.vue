<script setup lang="ts">
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { ref } from 'vue'

import { createVersion } from '../api'
import { VersionIcon } from '../icons'
import { inputClass, primaryButton, secondaryButton } from '../styles'
import FormProblem from './FormProblem.vue'

// Making the next version of an entry, with an optional note on why (such as "Results added").
// A version is a fixed, numbered copy of the current draft.

const props = defineProps<{ code: string }>()
const emit = defineEmits<{ close: [] }>()
const queryClient = useQueryClient()
const note = ref('')

const creating = useMutation({
  mutationFn: () => createVersion(props.code, note.value.trim()),
  onSuccess: async () => {
    // The entry's versions, history check and latest version number
    await queryClient.invalidateQueries({ queryKey: ['entry', props.code] })
    await queryClient.invalidateQueries({ queryKey: ['entries'] })
    emit('close')
  },
})
</script>

<template>
  <form
    aria-label="Create version"
    class="mt-3 max-w-3xl space-y-3 rounded-lg border border-line bg-panel p-4"
    @submit.prevent="creating.mutate()"
  >
    <FormProblem :error="creating.error.value" />
    <label class="block text-sm font-medium">
      Note <span class="font-normal text-muted">(optional)</span>
      <input
        v-model="note"
        placeholder="Such as: Results added"
        :class="[inputClass, 'border-line']"
        class="font-normal"
      />
    </label>
    <p class="text-sm text-muted">
      The version will be a fixed copy of the current draft, as last saved.
    </p>
    <div class="flex flex-wrap gap-3">
      <button
        type="submit"
        :class="primaryButton"
        class="inline-flex items-center gap-2 text-sm"
        :disabled="creating.isPending.value"
      >
        <VersionIcon aria-hidden="true" class="size-4 shrink-0" />
        {{ creating.isPending.value ? 'Creating…' : 'Create version' }}
      </button>
      <button type="button" :class="secondaryButton" @click="emit('close')">Cancel</button>
    </div>
  </form>
</template>
