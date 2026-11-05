<script setup lang="ts">
import { SiteAdminIcon } from '../icons'

// Marks a site admin, who can read every project and add to any of them (as in ProtoLIMS): a
// gold shield (with a dark tick, so it shows in both themes), and the words "Site admin" when
// `label` is set. Without them, the words are still there for screen readers, and as a tooltip.
withDefaults(defineProps<{ label?: boolean }>(), { label: false })
</script>

<template>
  <span class="inline-flex items-center gap-1" :title="label ? undefined : 'Site admin'">
    <SiteAdminIcon aria-hidden="true" class="size-4 shrink-0 fill-gold text-ink" />
    <span :class="label ? '' : 'sr-only'">Site admin</span>
  </span>
</template>
