<script setup lang="ts">
defineProps<{ error: string }>()

const emit = defineEmits<{
  download: [format: 'csv' | 'json']
}>()
</script>

<template>
  <article class="card pad export-metric">
    <div class="export-copy">
      <h2>Raw data</h2>
      <p class="sub">Download your personal entries, feedback, and blockers.</p>
    </div>
    <div class="export-actions">
      <a href="#export-csv" download @click.prevent="emit('download', 'csv')">CSV</a>
      <a href="#export-json" download @click.prevent="emit('download', 'json')">JSON</a>
    </div>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
  </article>
</template>
