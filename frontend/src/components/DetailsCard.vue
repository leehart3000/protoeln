<script setup lang="ts">
import { useId } from 'vue'

import { sectionHeading } from '../styles'
import EditLink from './EditLink.vue'

// The part of a page that its Edit form changes, in a box headed "Details" with the Edit button
// in its corner, so it's clear what the button applies to (as ProtoLIMS's DetailsCard). The
// button shows only to those who can edit (`canEdit`), greyed out while the site is read-only.
// Without `editTo`, there's no Edit button (as for an entry, which is edited in its draft).
defineProps<{ editTo?: string; editLabel?: string; canEdit?: boolean; readOnly?: boolean }>()

const headingId = useId()
</script>

<template>
  <section
    :aria-labelledby="headingId"
    class="mt-6 rounded-lg border border-line bg-panel p-4 sm:p-6"
  >
    <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <h2 :id="headingId" :class="sectionHeading">Details</h2>
      <EditLink
        v-if="canEdit && editTo && editLabel"
        :to="editTo"
        :label="editLabel"
        :read-only="readOnly === true"
      />
    </div>
    <slot />
  </section>
</template>
