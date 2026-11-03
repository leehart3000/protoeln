<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { ProfileIcon, SignInIcon, SignOutIcon } from '../icons'

// Signing in and out, in the header, styled as in ProtoLIMS. Signing in leaves the site for
// ORCID, which sends the browser back to the same page afterwards. The API does the whole
// sign-in (see backend/src/http/auth-routes.ts); this only starts it and shows the result.

interface Me {
  user: { name: string; orcid: string } | null
}

// Null until the API has answered, so nothing flickers while loading
const me = ref<Me | null>(null)

onMounted(async () => {
  try {
    const response = await fetch('/api/v1/me')
    me.value = response.ok ? ((await response.json()) as Me) : { user: null }
  } catch {
    me.value = { user: null }
  }
})

function signInHref() {
  const here = window.location.pathname + window.location.search
  return `/api/v1/auth/orcid/login?returnTo=${encodeURIComponent(here)}`
}

async function signOut() {
  await fetch('/api/v1/auth/logout', { method: 'POST' })
  me.value = { user: null }
}

const headerButton =
  'inline-flex min-h-11 items-center gap-2 rounded-md px-2.5 text-sm font-medium text-muted hover:bg-gold/15 hover:text-fg dark:hover:text-gold'
</script>

<template>
  <template v-if="me">
    <div v-if="me.user" class="flex items-center gap-1">
      <span :class="headerButton" :title="me.user.orcid">
        <ProfileIcon aria-hidden="true" class="size-5 shrink-0" />
        <span class="max-w-40 truncate max-sm:sr-only">{{ me.user.name }}</span>
      </span>
      <button type="button" :class="headerButton" @click="signOut">
        <SignOutIcon aria-hidden="true" class="size-5" />
        <span class="sr-only sm:not-sr-only">Sign out</span>
      </button>
    </div>
    <a v-else :href="signInHref()" title="Sign in with your ORCID iD" :class="headerButton">
      <SignInIcon aria-hidden="true" class="size-5" />
      <!-- On the narrowest phones only the icon shows, so the header fits on one line -->
      <span class="max-[25rem]:sr-only">Sign in</span>
    </a>
  </template>
</template>
