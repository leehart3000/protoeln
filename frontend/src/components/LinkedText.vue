<script setup lang="ts">
import { computed } from 'vue'

import { textLink } from '../styles'

// Free text (such as a licence or citation) with its line breaks kept, and its web addresses
// as links, opening in a new tab (as ProtoLIMS's LinkedText). Only https addresses become
// links, without any punctuation that ends a sentence or closes a bracket after them.
const props = defineProps<{ text: string }>()

const ADDRESS = /https:\/\/[^\s<>"]+/g
const TRAILING = /[.,;:!?)\]]+$/

const parts = computed(() => {
  const found: { text: string; link: boolean }[] = []
  let shown = 0
  for (const match of props.text.matchAll(ADDRESS)) {
    const address = match[0].replace(TRAILING, '')
    found.push({ text: props.text.slice(shown, match.index), link: false })
    found.push({ text: address, link: true })
    shown = match.index + address.length
  }
  found.push({ text: props.text.slice(shown), link: false })
  return found
})
</script>

<template>
  <span class="whitespace-pre-line wrap-anywhere"
    ><template v-for="(part, index) in parts" :key="index"
      ><a
        v-if="part.link"
        :href="part.text"
        :class="textLink"
        :aria-label="`${part.text} (opens in a new tab)`"
        target="_blank"
        rel="noopener noreferrer"
        >{{ part.text }}</a
      ><template v-else>{{ part.text }}</template></template
    ></span
  >
</template>
