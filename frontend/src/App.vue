<script setup lang="ts">
import AccountMenu from './components/AccountMenu.vue'
import ThemeToggle from './components/ThemeToggle.vue'
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="border-b border-line bg-panel">
      <div class="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:h-16 sm:gap-6">
        <a href="/" class="flex items-center gap-2.5">
          <!-- The wordmark beside it names the site, so the mark itself is decorative -->
          <img src="/brand/protoeln-mark.svg" alt="" class="size-8 dark:hidden" />
          <img src="/brand/protoeln-mark-dark.svg" alt="" class="hidden size-8 dark:block" />
          <span class="font-brand text-2xl tracking-tight sm:text-3xl">
            Proto<span class="font-bold text-primary">ELN</span>
          </span>
        </a>
        <div class="ml-auto flex items-center gap-1">
          <AccountMenu />
          <ThemeToggle />
        </div>
      </div>
    </header>

    <main class="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-10">
      <h1 class="text-3xl font-semibold">A living lab notebook</h1>
      <p class="mt-3 max-w-prose text-muted">
        Write up experiments, paste in tables and JSON results, and keep every revision.
      </p>
    </main>
  </div>
</template>
