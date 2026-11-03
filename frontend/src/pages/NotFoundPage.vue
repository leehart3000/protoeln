<script setup lang="ts">
import PageTitle from '../components/PageTitle.vue'
import { textLink } from '../styles'
</script>

<template>
  <PageTitle>Page not found</PageTitle>
  <p class="mt-3 max-w-2xl text-muted">
    There's nothing at this address.
    <RouterLink to="/" :class="textLink">Go to the home page</RouterLink>.
  </p>
</template>
