<script setup lang="ts">
import { computed } from 'vue'

import { NewIcon } from '../icons'
import { primaryButton } from '../styles'
import DisabledButton from './DisabledButton.vue'

// A button-styled link that starts creating a record, as ProtoLIMS's NewButton. With
// `refusal`, it's disabled, saying why, for anyone who can't do it.
//
// With `short`, it just says "Add", for beside a heading that already names the kind of
// record; its full name ("Add notebook", from "New notebook") is for screen readers and the
// tooltip. The labelled version goes at the end of the section.
const props = withDefaults(
  defineProps<{
    to: string
    label: string
    refusal?: string | null
    short?: boolean
    align?: 'start' | 'end'
  }>(),
  { refusal: null, short: false, align: 'end' },
)

const fullName = computed(() => (props.short ? props.label.replace(/^New /, 'Add ') : undefined))
const text = computed(() => (props.short ? 'Add' : props.label))
const buttonClass = `${primaryButton} text-sm`
</script>

<template>
  <DisabledButton
    v-if="refusal"
    :icon="NewIcon"
    :button-class="buttonClass"
    :reason="refusal"
    :align="align"
    :label="fullName"
  >
    {{ text }}
  </DisabledButton>
  <RouterLink
    v-else
    :to="to"
    :aria-label="fullName"
    :title="fullName"
    :class="buttonClass"
    class="inline-flex items-center gap-2"
  >
    <NewIcon aria-hidden="true" class="size-4 shrink-0" />
    {{ text }}
  </RouterLink>
</template>
