<script setup lang="ts">
import { NewIcon } from '../icons'
import { primaryButton } from '../styles'

// A button-styled link that starts creating a record (as ProtoLIMS's NewButton). Pages only
// show it to people who can create the record.
defineProps<{ to: string }>()
</script>

<template>
  <RouterLink :to="to" :class="primaryButton" class="inline-flex items-center gap-2 text-sm">
    <NewIcon aria-hidden="true" class="size-4 shrink-0" />
    <slot />
  </RouterLink>
</template>
