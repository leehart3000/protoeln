<script setup lang="ts">
import { errorBox } from '../styles'
import PageTitle from './PageTitle.vue'

// What a page shows while its data loads, if loading fails, or if the record isn't there
// (which is also what someone sees for a private project they can't read). Otherwise it shows
// the page itself, from the default slot.
defineProps<{ pending: boolean; failed: boolean; missing?: boolean; what: string }>()
</script>

<template>
  <p v-if="pending" class="text-muted">Loading {{ what }}…</p>
  <p v-else-if="failed" role="alert" :class="errorBox">
    Couldn't load the {{ what }}. Please try again in a moment.
  </p>
  <template v-else-if="missing">
    <PageTitle>{{ what.charAt(0).toUpperCase() + what.slice(1) }} not found</PageTitle>
    <p class="mt-3 max-w-prose text-muted">
      There's no {{ what }} here, or it's in a private project you can't see. If it's yours, try
      signing in.
    </p>
  </template>
  <slot v-else />
</template>
