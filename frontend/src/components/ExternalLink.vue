<script setup lang="ts">
import { ExternalIcon } from '../icons'
import { textLink } from '../styles'

// A link to another site, which opens in a new tab (as ProtoLIMS's ExternalLink): an icon after
// its words shows that, and screen readers are told. The link, its icon and anything given as
// `after` (such as a full stop) stay together on one line, so the icon never wraps on its own.
defineProps<{ href: string; text: string; after?: string }>()
</script>

<template>
  <!-- No spaces inside the link, so none is underlined -->
  <span class="whitespace-nowrap"
    ><a
      :href="href"
      :class="textLink"
      :aria-label="`${text} (opens in a new tab)`"
      target="_blank"
      rel="noopener noreferrer"
      >{{ text }}<ExternalIcon aria-hidden="true" class="ml-0.5 inline size-3.5" /></a
    >{{ after }}</span
  >
</template>
