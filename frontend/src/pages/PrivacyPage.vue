<script setup lang="ts">
import ExternalLink from '../components/ExternalLink.vue'
import PageTitle from '../components/PageTitle.vue'
import { SITE } from '../site'
import { sectionHeading, textLink } from '../styles'

// The site's privacy notice (as ProtoLIMS's). What the software keeps is the same everywhere;
// who runs the site, and where it's hosted, come from site.ts.
const section = 'mt-8 max-w-3xl'
const sectionBody = 'mt-3 space-y-3'
const list = 'list-disc space-y-1 pl-6'
const email = `mailto:${SITE.contactEmail}`
</script>

<template>
  <PageTitle>Privacy notice</PageTitle>

  <section :class="section">
    <h2 :class="sectionHeading">Who runs this site</h2>
    <div :class="sectionBody">
      <p>
        This site is run by {{ SITE.operator }}, {{ SITE.operatorDetail }}. {{ SITE.operator }}
        decides how personal data here is used, and is the data controller. Contact:
        <a :href="email" :class="textLink">{{ SITE.contactEmail }}</a
        >.
      </p>
    </div>
  </section>

  <section :class="section">
    <h2 :class="sectionHeading">What the site doesn't do</h2>
    <div :class="sectionBody">
      <p>
        There are no adverts, no analytics or tracking scripts, and nothing is sold or shared for
        marketing. You don't need to sign in to read the projects this site makes public.
      </p>
    </div>
  </section>

  <section :class="section">
    <h2 :class="sectionHeading">If you sign in with ORCID</h2>
    <div :class="sectionBody">
      <p>Signing in is for members of projects here, to add or change records. The site keeps:</p>
      <ul :class="list">
        <li>
          your <strong>ORCID iD</strong>, and your <strong>name</strong> as your ORCID record shares
          it (updated each time you sign in);
        </li>
        <li><strong>when you first and last signed in</strong>;</li>
        <li>
          a record of each <strong>signed-in browser</strong> (only a scrambled copy of its cookie),
          until you sign out or it expires;
        </li>
        <li>the <strong>projects</strong> you're a member of, and your role in each.</li>
      </ul>
      <p>
        A project's admins, or the site's administrators, may also add your ORCID iD to it before
        you've signed in.
      </p>
      <p>
        <strong>Changes you make</strong> (saving an entry, making a version, ticking a step, or
        changing a project's members) are recorded with your name or ORCID iD and the time. This is
        part of the scientific record of who did what, and when.
      </p>
    </div>
  </section>

  <section :class="section">
    <h2 :class="sectionHeading">Cookies and your browser</h2>
    <div :class="sectionBody">
      <p>
        The site sets only two cookies, both needed for signing in: one lasting 10 minutes while
        ORCID checks who you are, and your session, lasting up to 14 days. If you choose light or
        dark mode, that choice is saved in your own browser, not sent to the site.
      </p>
    </div>
  </section>

  <section :class="section">
    <h2 :class="sectionHeading">What the hosts record</h2>
    <div :class="sectionBody">
      <p>
        Like any website, each request passes through services that keep short-term logs of it.
        Those logs include your IP address, the page asked for, and your browser's description.
      </p>
    </div>
  </section>

  <section :class="section">
    <h2 :class="sectionHeading">Why (lawful basis)</h2>
    <div :class="sectionBody">
      <p>
        Legitimate interests: running the site, keeping it secure, and keeping an accurate record of
        who recorded what in lab notebooks.
      </p>
    </div>
  </section>

  <section :class="section">
    <h2 :class="sectionHeading">Who processes it for this site</h2>
    <div :class="sectionBody">
      <ul :class="list">
        <li v-for="{ name, role } in SITE.processors" :key="name">
          <strong>{{ name }}</strong> {{ role }}.
        </li>
      </ul>
      <p>
        Where data leaves the country, it's under those providers' published safeguards for
        international transfers.
      </p>
    </div>
  </section>

  <section :class="section">
    <h2 :class="sectionHeading">How long it's kept</h2>
    <div :class="sectionBody">
      <ul :class="list">
        <li>Your account details: while you have an account.</li>
        <li>Sign-ins in progress: 10 minutes at most.</li>
        <li>Sessions: 14 days at most.</li>
        <li>Hosting logs: {{ SITE.logsKept }}.</li>
        <li>The record of changes: kept as part of the scientific record.</li>
      </ul>
    </div>
  </section>

  <section :class="section">
    <h2 :class="sectionHeading">Your rights</h2>
    <div :class="sectionBody">
      <p>
        You can ask to see the personal data held about you, have it corrected, or have it deleted,
        and you can object to how it's used. Email
        <a :href="email" :class="textLink">{{ SITE.contactEmail }}</a
        >.
      </p>
      <p>
        If you have signed in, your name stays attached to the changes you made, as part of the
        record. Your account and memberships can be removed, and your name taken out where that
        doesn't break the record.
      </p>
      <p>
        You can also complain to
        <ExternalLink :href="SITE.regulator.url" :text="SITE.regulator.name" after="." />
      </p>
    </div>
  </section>

  <section :class="section">
    <h2 :class="sectionHeading">Changes to this notice</h2>
    <div :class="sectionBody">
      <p>Changes will be shown here, with the date. Last updated: {{ SITE.privacyUpdated }}.</p>
    </div>
  </section>
</template>
