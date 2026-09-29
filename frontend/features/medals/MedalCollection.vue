<script setup lang="ts">
import type { ApiMedal } from '~/types/api'

defineProps<{
  medals: ApiMedal[]
}>()
</script>

<template>
  <article class="card pad">
    <h2>Medals</h2>
    <div class="medal-table-scroll">
      <table class="medal-table">
        <thead>
          <tr>
            <th scope="col">Medal</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody v-for="medal in medals.slice(0, 4)" :key="medal.code" class="medal-table-group">
          <tr class="medal-primary-row">
            <th scope="row" :aria-describedby="`medal-meaning-${medal.code}`">{{ medal.name }}</th>
            <td><span class="medal-status" :class="{ awarded: medal.awarded }">{{ medal.awarded ? 'Awarded' : 'Waiting' }}</span></td>
          </tr>
          <tr class="medal-meaning-row">
            <td :id="`medal-meaning-${medal.code}`" colspan="2">{{ medal.description }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </article>
</template>
