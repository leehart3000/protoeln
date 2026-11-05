<script setup lang="ts">
// Which site this is, in gold beside the logo, when it isn't the real one: "Staging" or
// "Local" (as in ProtoLIMS). Production builds have none (see vite.config.ts).
const environment = import.meta.env.VITE_APP_ENVIRONMENT as string | undefined
</script>

<template>
  <span
    v-if="environment"
    class="rounded-md bg-gold px-2 py-0.5 text-xs font-semibold tracking-wide text-ink uppercase"
  >
    {{ environment }}
  </span>
</template>
