<script setup lang="ts">
import { textLink } from '../styles'

// Crumbs with a link lead back up the hierarchy; the last one (no link) is the current page
defineProps<{ items: { label: string; to?: string; mono?: boolean }[] }>()
</script>

<template>
  <nav aria-label="Breadcrumb" class="mb-4 text-sm">
    <ol class="flex flex-wrap items-center gap-x-2 gap-y-1">
      <li
        v-for="(item, index) in items"
        :key="`${index}-${item.label}`"
        class="flex min-w-0 items-center gap-x-2 wrap-anywhere"
      >
        <span v-if="index > 0" aria-hidden="true" class="text-muted">›</span>
        <RouterLink v-if="item.to" :to="item.to" :class="[textLink, item.mono && 'font-mono']">
          {{ item.label }}
        </RouterLink>
        <span v-else aria-current="page" :class="['font-medium', item.mono && 'font-mono']">
          {{ item.label }}
        </span>
      </li>
    </ol>
  </nav>
</template>
