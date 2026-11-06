<script setup lang="ts">
import { EditIcon } from '../icons'
import { READ_ONLY_REASON } from '../permissions'
import { secondaryButton } from '../styles'
import DisabledButton from './DisabledButton.vue'

// A link to a record's edit page, such as "Edit project", shown to those who can change it
// (see DetailsCard). While the site is read-only, it's greyed out, saying why.
defineProps<{ to: string; label: string; readOnly: boolean }>()
</script>

<template>
  <DisabledButton
    v-if="readOnly"
    :icon="EditIcon"
    :button-class="secondaryButton"
    :reason="READ_ONLY_REASON"
  >
    {{ label }}
  </DisabledButton>
  <RouterLink v-else :to="to" :class="secondaryButton" class="inline-flex items-center gap-2">
    <EditIcon aria-hidden="true" class="size-4 shrink-0" />
    {{ label }}
  </RouterLink>
</template>
