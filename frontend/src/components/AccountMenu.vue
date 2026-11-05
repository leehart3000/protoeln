<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { signInHref } from '../api'
import { ProfileIcon, SignInIcon } from '../icons'
import { useMe } from '../useMe'
import SignOutButton from './SignOutButton.vue'
import SiteAdminBadge from './SiteAdminBadge.vue'

// Signing in and out, in the header, as in ProtoLIMS. Signing in leaves the site for ORCID,
// which sends the browser back to the same page afterwards. Once signed in, the name links to
// the profile page. On phones, only its icon shows, and signing out is done from the profile
// page, so the header fits on one line.

const me = useMe()
const route = useRoute()

// Nothing shows until the API has answered, so nothing flickers while loading. If it can't
// be reached, "Sign in" shows.
const answered = computed(() => me.data.value !== undefined || me.isError.value)
const user = computed(() => me.data.value?.user ?? null)

const headerButton =
  'inline-flex min-h-11 items-center gap-2 rounded-md px-2.5 text-sm font-medium text-muted hover:bg-gold/15 hover:text-fg dark:hover:text-gold'
</script>

<template>
  <template v-if="answered">
    <div v-if="user" class="flex items-center gap-1">
      <RouterLink to="/profile" title="Your profile" :class="headerButton">
        <ProfileIcon aria-hidden="true" class="size-5 shrink-0" />
        <span class="max-w-40 truncate max-sm:sr-only">{{ user.name }}</span>
        <!-- A space between the name and "Site admin", so screen readers don't run them together
          (Vue leaves out the spaces between tags; this one doesn't show, as the link is flex) -->
        <template v-if="user.siteAdmin">{{ ' ' }}<SiteAdminBadge /></template>
      </RouterLink>
      <SignOutButton
        :button-class="[headerButton, 'max-sm:hidden']"
        label-class="sr-only sm:not-sr-only"
      />
    </div>
    <a
      v-else
      :href="signInHref(route.fullPath)"
      title="Sign in with your ORCID iD"
      :class="headerButton"
    >
      <SignInIcon aria-hidden="true" class="size-5" />
      <!-- On the narrowest phones only the icon shows, so the header fits on one line -->
      <span class="max-[25rem]:sr-only">Sign in</span>
    </a>
  </template>
</template>
