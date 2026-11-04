<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref, toRef, useId } from 'vue'

import { changeRole, fetchMembers, fieldProblems, type ProjectRole } from '../api'
import { ROLE_LABELS } from '../format'
import { AddPersonIcon, MembersIcon } from '../icons'
import {
  errorBox,
  fieldProblem,
  inputClass,
  primaryButton,
  sectionHeading,
  table,
  tableHead,
  tableHeader,
  tableWrapper,
} from '../styles'
import { useMe } from '../useMe'
import MemberRow from './MemberRow.vue'

// Who has a role in the project, and changing that (as in ProtoLIMS). Only the project's admins
// and site admins see it. Only site admins can give or take away the project admin role.

const props = defineProps<{ code: string }>()
const code = toRef(props, 'code')
const me = useMe()
const queryClient = useQueryClient()

const adminLocked = computed(() =>
  me.data.value?.user?.siteAdmin
    ? undefined
    : 'Only site admins can give or take away the project admin role.',
)

const members = useQuery({
  queryKey: ['members', code],
  queryFn: () => fetchMembers(code.value),
})

// What the last change did, so there's evidence of it
const notice = ref('')
const newOrcid = ref('')
const newRole = ref<ProjectRole>('viewer')

const change = useMutation({
  mutationFn: (input: { orcid: string; role: ProjectRole | null; who: string }) =>
    changeRole(code.value, input.orcid, input.role),
  onMutate: () => {
    notice.value = ''
  },
  onSuccess: async (updated, { role, who, orcid }) => {
    queryClient.setQueryData(['members', code.value], updated)
    notice.value =
      role === null ? `${who}’s role was removed.` : `${who} now has the ${ROLE_LABELS[role]} role.`
    if (orcid === newOrcid.value) {
      newOrcid.value = ''
    }
    // Someone's own role may have changed, and what they can do with it
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['me'] }),
      queryClient.invalidateQueries({ queryKey: ['project', code.value] }),
      queryClient.invalidateQueries({ queryKey: ['projects'] }),
    ])
  },
})
const problems = computed(() => fieldProblems(change.error.value))

function add() {
  const orcid = newOrcid.value.trim()
  change.mutate({ orcid, role: newRole.value, who: orcid })
}

const orcidId = useId()
const roleId = useId()
const ROLE_ORDER: ProjectRole[] = ['viewer', 'member', 'admin']
const header = `${tableHeader} max-sm:px-2`
</script>

<template>
  <section aria-labelledby="members-heading" class="mt-10">
    <h2 id="members-heading" :class="sectionHeading" class="flex items-center gap-2">
      <MembersIcon aria-hidden="true" class="size-5 shrink-0" />
      Members
    </h2>
    <p class="mt-2 max-w-2xl text-muted">
      Viewers can read the project; members can also add notebooks and entries; project admins can
      also choose its members.
    </p>

    <!-- Always present, so screen readers announce each new notice -->
    <p role="status" class="mt-4 text-sm font-medium empty:hidden">{{ notice }}</p>
    <p v-if="change.isError.value && !problems.orcid" role="alert" :class="errorBox" class="mt-4">
      {{ change.error.value?.message }}.
    </p>

    <p v-if="members.isPending.value" class="mt-4 text-muted">Loading members…</p>
    <!-- Not an alert: it's a side section, and the page's own errors matter more -->
    <p v-else-if="members.isError.value" :class="errorBox" class="mt-4">
      Couldn't load the members. Please try again in a moment.
    </p>
    <p v-else-if="members.data.value?.length === 0" class="mt-4 text-muted">
      No one has a role here yet.
    </p>
    <div v-else :class="tableWrapper" class="mt-4">
      <table :class="table" aria-label="Members">
        <thead :class="tableHead">
          <tr>
            <th scope="col" :class="header">Name and ORCID iD</th>
            <th scope="col" :class="header">Role</th>
            <th scope="col" :class="header" class="w-px"><span class="sr-only">Remove</span></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          <!-- Keyed by role too, so the row starts afresh when the role changes -->
          <MemberRow
            v-for="member in members.data.value"
            :key="`${member.orcid}-${member.role}`"
            :member="member"
            :busy="change.isPending.value"
            :admin-locked="adminLocked"
            @change="(role) => change.mutate({ orcid: member.orcid, role, who: member.name })"
          />
        </tbody>
      </table>
    </div>

    <form
      aria-label="Add someone"
      class="mt-4 flex flex-wrap items-start gap-3"
      @submit.prevent="add"
    >
      <div class="w-56">
        <label :for="orcidId" class="block font-medium">ORCID iD</label>
        <input
          :id="orcidId"
          v-model="newOrcid"
          required
          placeholder="0000-0002-1825-0097"
          autocomplete="off"
          :aria-invalid="problems.orcid ? true : undefined"
          :class="[inputClass, problems.orcid ? 'border-danger' : 'border-line']"
          class="font-mono"
        />
        <p v-if="problems.orcid" :class="fieldProblem">The ORCID iD {{ problems.orcid }}.</p>
      </div>
      <div>
        <label :for="roleId" class="block font-medium">Role</label>
        <select :id="roleId" v-model="newRole" :class="[inputClass, 'border-line']">
          <option
            v-for="role in ROLE_ORDER"
            :key="role"
            :value="role"
            :disabled="role === 'admin' && adminLocked !== undefined"
          >
            {{ ROLE_LABELS[role] }}
          </option>
        </select>
      </div>
      <button
        type="submit"
        :disabled="change.isPending.value"
        :class="primaryButton"
        class="mt-7 inline-flex items-center gap-2 text-sm"
      >
        <AddPersonIcon aria-hidden="true" class="size-4 shrink-0" />
        Add member
      </button>
    </form>
    <p class="mt-2 text-sm text-muted">
      People can be added before they first sign in: their role will be waiting for them.
      <template v-if="adminLocked">{{ adminLocked }}</template>
    </p>
  </section>
</template>
