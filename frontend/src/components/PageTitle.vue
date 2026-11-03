<script setup lang="ts">
import type { Component } from 'vue'

// A page heading in the wordmark's typeface, with an icon for the kind of record the page is
// about (from icons.ts), as in ProtoLIMS
defineProps<{ icon?: Component }>()
</script>

<template>
  <h1 class="flex items-start gap-2.5 font-brand text-2xl tracking-tight sm:text-3xl">
    <component
      :is="icon"
      v-if="icon"
      aria-hidden="true"
      class="mt-0.5 size-6 shrink-0 sm:mt-1 sm:size-7"
    />
    <!-- Long titles with no spaces wrap rather than overflow -->
    <span class="min-w-0 font-bold wrap-anywhere"><slot /></span>
  </h1>
</template>
