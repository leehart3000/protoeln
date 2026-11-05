<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { signInHref, type ProjectRole } from '../api'
import PageTitle from '../components/PageTitle.vue'
import SignOutButton from '../components/SignOutButton.vue'
import SiteAdminBadge from '../components/SiteAdminBadge.vue'
import { formatDate, ROLE_LABELS } from '../format'
import { ExternalIcon, ProfileIcon, SignInIcon } from '../icons'
import {
  primaryButton,
  secondaryButton,
  sectionHeading,
  table,
  tableCell,
  tableHead,
  tableHeader,
  tableWrapper,
  textLink,
} from '../styles'
import { useMe } from '../useMe'

// The signed-in person's profile: who they are, and what they can do here (as in ProtoLIMS)

const me = useMe()
const route = useRoute()
const user = computed(() => me.data.value?.user ?? null)

// What a role lets someone do in its project
const ALLOWS: Record<ProjectRole, string> = {
  admin: 'You can read it, add notebooks and entries, and choose its members.',
  contributor: 'You can read it, add notebooks and entries, and edit your own.',
  viewer: 'You can read it.',
}
</script>

<template>
  <PageTitle :icon="ProfileIcon">Your profile</PageTitle>
  <p v-if="me.isPending.value" class="mt-3 text-muted">Loading your profile…</p>
  <template v-else-if="!user">
    <p class="mt-3 text-muted">You're not signed in.</p>
    <p class="mt-6">
      <a
        :href="signInHref(route.fullPath)"
        :class="primaryButton"
        class="inline-flex items-center gap-2"
      >
        <SignInIcon aria-hidden="true" class="size-5" />
        Sign in with ORCID
      </a>
    </p>
  </template>
  <template v-else>
    <dl class="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
      <dt class="text-muted">Name</dt>
      <dd class="font-medium">{{ user.name }}</dd>
      <dt class="text-muted">ORCID iD</dt>
      <dd>
        <a
          :href="user.orcidUrl"
          :class="textLink"
          class="inline-flex items-center gap-1 font-mono"
          :aria-label="`${user.orcid} (opens in a new tab)`"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ user.orcid }}
          <ExternalIcon aria-hidden="true" class="size-3.5 shrink-0" />
        </a>
      </dd>
      <template v-if="user.since">
        <dt class="text-muted">On ProtoELN since</dt>
        <dd>{{ formatDate(user.since) }}</dd>
      </template>
      <template v-if="user.siteAdmin">
        <dt class="text-muted">Site admin</dt>
        <dd>
          <SiteAdminBadge label />
          <p class="mt-1 text-muted">You can read every project, and add to any of them.</p>
        </dd>
      </template>
    </dl>

    <h2 :class="sectionHeading" class="mt-8">Your roles</h2>
    <p v-if="user.roles.length === 0" class="mt-3 max-w-2xl text-muted">
      <template v-if="user.siteAdmin">
        As a site admin you don't need roles: you can read every project, and add to any of them.
      </template>
      <template v-else>
        You have no roles yet, so you can read public projects but not add to them. A project's
        admin can give you a role.
      </template>
    </p>
    <div v-else :class="tableWrapper" class="mt-4">
      <table :class="table" aria-label="Your roles">
        <thead :class="tableHead">
          <tr>
            <th scope="col" :class="tableHeader">Project</th>
            <th scope="col" :class="tableHeader">Role</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          <tr v-for="role in user.roles" :key="role.project.code">
            <td :class="tableCell">
              <RouterLink
                :to="`/projects/${role.project.code}`"
                :class="textLink"
                class="font-mono"
              >
                {{ role.project.code }}
              </RouterLink>
              <p class="mt-1">{{ role.project.title }}</p>
            </td>
            <td :class="tableCell">
              <span class="font-medium">{{ ROLE_LABELS[role.role] }}</span>
              <p class="mt-1 text-muted">{{ ALLOWS[role.role] }}</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mt-8">
      <SignOutButton :button-class="[secondaryButton, 'inline-flex items-center gap-2']" />
    </div>
  </template>
</template>
