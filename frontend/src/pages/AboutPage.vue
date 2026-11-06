<script setup lang="ts">
import { computed } from 'vue'

import ExternalLink from '../components/ExternalLink.vue'
import PageTitle from '../components/PageTitle.vue'
import { SITE } from '../site'
import { textLink } from '../styles'
import { useMe } from '../useMe'

// What ProtoELN is, and about this site (as ProtoLIMS's About page). Who runs it comes from
// site.ts.
const LICENCE_URL = 'https://www.gnu.org/licenses/agpl-3.0.html'
const runBy = `This site is run by ${SITE.operator}, ${SITE.operatorDetail}.`
const email = SITE.contactEmail
const sourceUrl = SITE.sourceUrl

// Who can read the site, and whether it can be changed, as it's set up now (shown once that's
// known)
const me = useMe()
const howItsUsed = computed(() => {
  const details = me.data.value
  if (details === undefined) return ''
  const reading = details.publicRead
    ? 'Anyone can read a public project without signing in; other projects can be seen only by their members.'
    : 'This site is private: its projects can be seen only by their members, once signed in.'
  const changing = details.readOnly
    ? "It's read-only at the moment, so nothing can be changed."
    : 'Members of a project can add and change its notebooks and entries, and every change is recorded.'
  return `${reading} ${changing}`
})
</script>

<template>
  <PageTitle>About ProtoELN</PageTitle>
  <div class="mt-6 max-w-3xl space-y-4">
    <p>
      <strong>ProtoELN</strong> is an electronic lab notebook (ELN) for research labs, and a
      companion to <ExternalLink href="https://protolims.org" text="ProtoLIMS" after="." /> Each
      <RouterLink to="/projects" :class="textLink">project</RouterLink> has notebooks, and each
      notebook has entries: what was planned, done and found. An entry can hold checklists of
      protocol steps, tables of materials, and links to records in ProtoLIMS or another LIMS.
    </p>
    <p>
      Every save of an entry is recorded, with who made it and when. When an entry is ready, it can
      be made into a numbered version, which never changes.
    </p>
    <p v-if="howItsUsed">{{ howItsUsed }}</p>
    <p>
      ProtoELN is <strong>open source</strong>, under the
      <ExternalLink :href="LICENCE_URL" text="GNU Affero General Public License v3.0" after="." />
      This site's <ExternalLink :href="sourceUrl" text="source code" /> is available.
    </p>
    <p>
      {{ runBy }} Contact: <a :href="`mailto:${email}`" :class="textLink">{{ email }}</a
      >. See also the <RouterLink to="/privacy" :class="textLink">privacy notice</RouterLink>.
    </p>
  </div>
</template>
