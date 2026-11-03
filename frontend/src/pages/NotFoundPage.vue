<script setup lang="ts">
import PageTitle from '../components/PageTitle.vue'
import { textLink } from '../styles'
</script>

<template>
  <PageTitle>Page not found</PageTitle>
  <p class="mt-3 max-w-prose text-muted">
    There's nothing at this address.
    <RouterLink to="/" :class="textLink">See the projects</RouterLink>.
  </p>
</template>
