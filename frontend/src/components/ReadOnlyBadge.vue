<script setup lang="ts">
import { ReadOnlyIcon } from '../icons'
import { READ_ONLY_REASON } from '../permissions'
import { useMe } from '../useMe'

// In the header while the site is read-only (PROTOELN_READ_ONLY), as in ProtoLIMS: a lock, and
// the word "Read-only" from small screens up (on phones, for screen readers and as a tooltip)
const me = useMe()
</script>

<template>
  <span
    v-if="me.data.value?.readOnly"
    :title="READ_ONLY_REASON"
    class="inline-flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-xs font-semibold text-muted"
  >
    <ReadOnlyIcon aria-hidden="true" class="size-3.5 shrink-0" />
    <span class="max-sm:sr-only">Read-only</span>
  </span>
</template>
