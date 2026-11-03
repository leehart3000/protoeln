<script setup lang="ts">
import { ApiError } from '../api'
import { errorBox } from '../styles'

// Why a form couldn't be sent, above the form. When fields have problems, each is shown under
// its field, so this only says to look there.
defineProps<{ error: Error | null }>()
</script>

<template>
  <p v-if="error" role="alert" :class="errorBox">
    <template v-if="error instanceof ApiError && error.problems.length > 0">
      Please correct the problems below.
    </template>
    <template v-else-if="error instanceof ApiError">{{ error.message }}.</template>
    <template v-else>Couldn't reach ProtoELN. Please try again in a moment.</template>
  </p>
</template>
