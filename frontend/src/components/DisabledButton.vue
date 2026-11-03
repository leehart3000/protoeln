<script setup lang="ts">
import { useId, type Component } from 'vue'

// A button that can't be used, and why (as ProtoLIMS's DisabledButton). It's marked
// aria-disabled rather than disabled, so it can still be reached with the keyboard. The reason
// shows on hover, focus or tap, and screen readers read it as the button's description. `align`
// is the side of the button the reason lines up with, so it stays on the page. `label`, if
// given, is its name for screen readers, for when the visible text doesn't say enough.
withDefaults(
  defineProps<{
    icon: Component
    buttonClass: string
    reason: string
    align?: 'start' | 'end'
    label?: string
  }>(),
  { align: 'end', label: undefined },
)

const reasonId = useId()
</script>

<template>
  <span class="group relative inline-flex">
    <button
      type="button"
      aria-disabled="true"
      :aria-label="label"
      :aria-describedby="reasonId"
      :class="buttonClass"
      class="inline-flex cursor-not-allowed items-center gap-2 opacity-50"
    >
      <component :is="icon" aria-hidden="true" class="size-4 shrink-0" />
      <slot />
    </button>
    <span
      :id="reasonId"
      role="tooltip"
      :class="align === 'end' ? 'right-0' : 'left-0'"
      class="pointer-events-none absolute top-full z-10 mt-1.5 hidden w-max max-w-64 rounded-md bg-fg px-2.5 py-1.5 text-xs font-medium text-page shadow-md group-focus-within:block group-hover:block"
    >
      {{ reason }}
    </span>
  </span>
</template>
