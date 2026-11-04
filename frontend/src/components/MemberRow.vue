<script setup lang="ts">
import { computed, nextTick, ref, useId, useTemplateRef } from 'vue'

import type { Member, ProjectRole } from '../api'
import { ROLE_LABELS } from '../format'
import { ExternalIcon, RemovePersonIcon, SaveIcon } from '../icons'
import { dangerButton, secondaryButton, tableCell, textLink, unsavedButton } from '../styles'
import DisabledButton from './DisabledButton.vue'

// One member's row (as in ProtoLIMS): a new role is chosen, then saved; or they're removed, once
// that's confirmed. For anyone who can't give or take away the admin role (`adminLocked` says
// why), an admin's row is read-only, and "Project admin" can't be chosen for anyone else.

const props = defineProps<{ member: Member; busy: boolean; adminLocked?: string }>()
const emit = defineEmits<{ change: [role: ProjectRole | null] }>()

const ROLE_ORDER: ProjectRole[] = ['viewer', 'member', 'admin']

const chosen = ref<ProjectRole>(props.member.role)
const unsaved = computed(() => chosen.value !== props.member.role)
const confirming = ref(false)
const cancelButton = useTemplateRef<HTMLButtonElement>('cancel')

// Asks before removing anyone, with focus on Cancel, the safe choice
async function askToRemove() {
  confirming.value = true
  await nextTick()
  cancelButton.value?.focus()
}
const unsavedId = useId()
const locked = computed(() => (props.member.role === 'admin' ? props.adminLocked : undefined))

// Less padding on phones, so the three columns fit without scrolling
const cell = `${tableCell} max-sm:px-2`
</script>

<template>
  <tr>
    <td :class="cell">
      <span v-if="member.signedIn">{{ member.name }}</span>
      <span v-else class="text-muted italic">Not signed in yet</span>
      <a
        :href="member.orcidUrl"
        :class="textLink"
        class="mt-0.5 flex w-fit items-center gap-1 font-mono text-xs"
        :aria-label="`${member.orcid} (opens in a new tab)`"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ member.orcid }}
        <ExternalIcon aria-hidden="true" class="size-3 shrink-0" />
      </a>
    </td>
    <td :class="cell">
      <template v-if="locked">{{ ROLE_LABELS[member.role] }}</template>
      <!-- Save goes under the role on narrow screens -->
      <div v-else class="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
        <select
          v-model="chosen"
          :aria-label="`Role for ${member.name}`"
          :disabled="busy"
          class="rounded-md border border-line bg-panel px-2 py-1"
        >
          <option
            v-for="role in ROLE_ORDER"
            :key="role"
            :value="role"
            :disabled="role === 'admin' && adminLocked !== undefined"
          >
            {{ ROLE_LABELS[role] }}
          </option>
        </select>
        <!-- Gold while there's a change to save, so it isn't missed -->
        <button
          type="button"
          :aria-label="`Save role for ${member.name}`"
          :aria-describedby="unsaved ? unsavedId : undefined"
          :disabled="busy || !unsaved"
          :class="unsaved ? unsavedButton : secondaryButton"
          class="inline-flex items-center gap-2"
          @click="emit('change', chosen)"
        >
          <SaveIcon aria-hidden="true" class="size-4 shrink-0" />
          Save
        </button>
        <span v-if="unsaved" :id="unsavedId" class="sr-only">Unsaved change</span>
      </div>
    </td>
    <td :class="cell">
      <DisabledButton
        v-if="locked"
        :icon="RemovePersonIcon"
        :button-class="secondaryButton"
        :reason="locked"
        :label="`Remove ${member.name}`"
      >
        <span class="hidden sm:inline">Remove</span>
      </DisabledButton>
      <button
        v-else
        type="button"
        :aria-label="`Remove ${member.name}`"
        :aria-expanded="confirming"
        :disabled="busy"
        :class="secondaryButton"
        class="inline-flex items-center gap-2"
        @click="askToRemove"
      >
        <RemovePersonIcon aria-hidden="true" class="size-4 shrink-0" />
        <!-- Just the icon on narrow screens; the button's label still names who -->
        <span class="hidden sm:inline">Remove</span>
      </button>
    </td>
  </tr>
  <!-- The question goes on a row of its own, across the table, so it never makes the table
       wider than the screen -->
  <tr v-if="confirming">
    <td colspan="3" :class="cell" class="bg-danger-bg">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p class="text-sm font-medium text-danger">Remove {{ member.name }}’s role?</p>
        <div class="flex gap-2">
          <button
            type="button"
            :disabled="busy"
            :class="dangerButton"
            @click="emit('change', null)"
          >
            Yes, remove
          </button>
          <button ref="cancel" type="button" :class="secondaryButton" @click="confirming = false">
            Cancel
          </button>
        </div>
      </div>
    </td>
  </tr>
</template>
