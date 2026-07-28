<script setup lang="ts">
import { useI18n } from 'vue-i18n'

// Throws: SyntaxError: Must be called at the top of a `setup` function
const { t } = useI18n()
</script>

<template>
  <h1>{{ t('hello') }}</h1>
</template>
