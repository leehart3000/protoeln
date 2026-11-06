<script setup lang="ts">
import { computed, ref } from 'vue'

// An image in an entry's content (a fileBlock), from the API (which shows it only to those who
// can read the entry), with its caption. If it can't be shown (it isn't there, or this site
// keeps no files), a note says so in its place.
const props = defineProps<{ fileId: string; alt?: string; caption?: string }>()

// File ids are SHA-256s; anything else isn't a file the API could have
const source = computed(() =>
  /^[0-9a-f]{64}$/.test(props.fileId) ? `/api/v1/files/${props.fileId}` : null,
)
const failed = ref(false)
</script>

<template>
  <figure class="my-4">
    <img
      v-if="source && !failed"
      :src="source"
      :alt="alt ?? ''"
      loading="lazy"
      class="h-auto max-w-full rounded-md border border-line bg-white"
      @error="failed = true"
    />
    <p v-else class="rounded-md border border-dashed border-line px-4 py-3 text-sm text-muted">
      This image can't be shown here.<template v-if="alt"> It shows: {{ alt }}</template>
    </p>
    <figcaption v-if="caption" class="mt-2 text-sm text-muted">{{ caption }}</figcaption>
  </figure>
</template>
