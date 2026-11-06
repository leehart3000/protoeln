<script setup lang="ts">
import { useRoute } from 'vue-router'

import AccountMenu from './components/AccountMenu.vue'
import EnvironmentBadge from './components/EnvironmentBadge.vue'
import ExternalLink from './components/ExternalLink.vue'
import ReadOnlyBadge from './components/ReadOnlyBadge.vue'
import ThemeToggle from './components/ThemeToggle.vue'
import { EntryIcon, NotebookIcon, ProjectIcon } from './icons'

// The main navigation, as in ProtoLIMS: a link to the list of each kind of record. A link is
// marked as the current one on its list and on the pages of its records (so "Notebooks" is
// marked on a notebook's page). On phones, only the icons show.
const NAV_LINKS = [
  { to: '/projects', label: 'Projects', icon: ProjectIcon },
  { to: '/notebooks', label: 'Notebooks', icon: NotebookIcon },
  { to: '/entries', label: 'Entries', icon: EntryIcon },
]

const route = useRoute()

// The footer, as in ProtoLIMS's: where the source code is (the AGPL asks for it to be offered),
// and which version and commit this is (see buildInfo in vite.config.ts)
const SOURCE_URL = 'https://gitlab.com/leehart3000/protoeln'
const LICENCE_URL = 'https://www.gnu.org/licenses/agpl-3.0.html'
const VERSION = `${import.meta.env.VITE_APP_VERSION}/${import.meta.env.VITE_APP_COMMIT}`

function isCurrent(to: string) {
  return route.path === to || route.path.startsWith(`${to}/`)
}

function navLinkClass(current: boolean) {
  return [
    '-mb-px flex items-center gap-1.5 border-b-2 px-2.5 py-2.5 text-sm font-medium md:px-3',
    current
      ? 'border-primary text-primary'
      : 'border-transparent text-muted hover:border-gold hover:text-fg dark:hover:text-gold',
  ]
}
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="border-b border-line bg-panel">
      <div class="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:h-16 sm:gap-6">
        <RouterLink to="/" class="flex items-center gap-2.5">
          <!-- The wordmark beside it names the site, so the mark itself is decorative -->
          <img src="/brand/protoeln-mark.svg" alt="" class="size-8 dark:hidden" />
          <img src="/brand/protoeln-mark-dark.svg" alt="" class="hidden size-8 dark:block" />
          <span class="font-brand text-2xl tracking-tight sm:text-3xl">
            Proto<span class="font-bold text-primary">ELN</span>
          </span>
        </RouterLink>
        <EnvironmentBadge />
        <ReadOnlyBadge />
        <div class="ml-auto flex items-center gap-1">
          <AccountMenu />
          <ThemeToggle />
        </div>
      </div>
      <nav aria-label="Main" class="border-t border-line">
        <div class="mx-auto flex max-w-6xl justify-around px-2 md:justify-start md:gap-1">
          <RouterLink
            v-for="link in NAV_LINKS"
            :key="link.to"
            :to="link.to"
            :class="navLinkClass(isCurrent(link.to))"
            :aria-current="isCurrent(link.to) ? 'page' : undefined"
          >
            <component :is="link.icon" aria-hidden="true" class="size-5 shrink-0 md:size-4" />
            <span class="max-md:sr-only">{{ link.label }}</span>
          </RouterLink>
        </div>
      </nav>
    </header>

    <main class="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-10">
      <RouterView />
    </main>

    <footer class="border-t border-line">
      <div
        class="mx-auto flex max-w-6xl flex-wrap justify-between gap-x-6 gap-y-2 px-4 py-6 text-sm text-muted"
      >
        <p>
          ProtoELN is <ExternalLink :href="SOURCE_URL" text="free software" /> under the
          <ExternalLink :href="LICENCE_URL" text="GNU AGPL v3" after="." />
        </p>
        <p>Version {{ VERSION }}</p>
      </div>
    </footer>
  </div>
</template>
