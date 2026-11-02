<script setup lang="ts"></script>

<template>
  <header class="border-b border-line bg-panel">
    <div class="mx-auto flex max-w-5xl items-center gap-3 px-6 py-4">
      <!-- The wordmark beside it names the site, so the mark itself is decorative -->
      <img src="/brand/protoeln-mark.svg" alt="" class="size-8 dark:hidden" />
      <img src="/brand/protoeln-mark-dark.svg" alt="" class="hidden size-8 dark:block" />
      <span class="font-brand text-2xl tracking-tight text-fg"
        >Proto<span class="font-bold text-primary">ELN</span></span
      >
    </div>
  </header>
  <main class="mx-auto max-w-5xl px-6 py-12">
    <h1 class="text-3xl font-semibold">A living lab notebook</h1>
    <p class="mt-3 max-w-prose text-muted">
      Write up experiments, paste in tables and JSON results, and keep every revision.
    </p>
  </main>
</template>
