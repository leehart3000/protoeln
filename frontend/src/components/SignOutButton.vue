<script setup lang="ts">
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'

import { signOut, type Me } from '../api'
import { SignOutIcon } from '../icons'

// Signing out, in the header (on wider screens) and on the profile page (as in ProtoLIMS).
// `buttonClass` styles the button; `labelClass` the words "Sign out" (to hide them on phones).
defineProps<{ buttonClass: string | string[]; labelClass?: string }>()

const router = useRouter()
const queryClient = useQueryClient()
const signingOut = useMutation({
  mutationFn: signOut,
  // Signing out goes to the home page (the page someone was on may be in a private project).
  // No one is signed in now, and what can be seen may have changed, so everything else shown is
  // fetched again; whether the site is read-only stays as it was.
  onSuccess: async () => {
    const readOnly = queryClient.getQueryData<Me>(['me'])?.readOnly
    await router.push('/')
    queryClient.setQueryData(['me'], { user: null, readOnly })
    await queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== 'me' })
  },
})
</script>

<template>
  <span class="inline-flex items-center gap-2">
    <span v-if="signingOut.isError.value" role="alert" class="text-sm font-medium text-danger">
      Couldn't sign out
    </span>
    <button
      type="button"
      :class="buttonClass"
      :disabled="signingOut.isPending.value"
      @click="signingOut.mutate()"
    >
      <SignOutIcon aria-hidden="true" class="size-5" />
      <span :class="labelClass">Sign out</span>
    </button>
  </span>
</template>
