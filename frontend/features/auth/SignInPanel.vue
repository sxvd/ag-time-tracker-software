<script setup lang="ts">
import { withAppBase } from '~~/shared/utils/url'

const props = withDefaults(defineProps<{
  restoring: boolean
  showForm?: boolean
  error?: string
}>(), {
  showForm: false,
  error: ''
})

const emit = defineEmits<{
  open: []
  submit: [credentials: { email: string, password: string }]
}>()

const email = ref('')
const password = ref('')
const logoUrl = withAppBase(useRuntimeConfig().app.baseURL, '/airgradient-logo.svg')

function submit() {
  emit('submit', {
    email: email.value.trim(),
    password: password.value
  })
}
</script>

<template>
  <main v-if="props.restoring" class="auth-shell">
    <article class="signin-card status-card">
      <img class="signin-logo" :src="logoUrl" alt="AirGradient">
      <p class="eyebrow">AirGradient Time Tracker</p>
      <h2>Restoring workspace</h2>
    </article>
  </main>

  <main v-else class="auth-shell">
    <section class="signin-screen">
      <article class="signin-card">
        <img class="signin-logo" :src="logoUrl" alt="AirGradient">
        <p class="eyebrow">AirGradient sign in</p>
        <h2>{{ props.showForm ? 'Sign in to continue' : 'Welcome to the time tracker' }}</h2>

        <form v-if="props.showForm" class="signin-form" @submit.prevent="submit">
          <label>
            Work email
            <input v-model.trim="email" required type="email" autocomplete="email" placeholder="name@airgradient.com">
          </label>
          <label>
            Password
            <input
              v-model="password"
              required
              type="password"
              autocomplete="current-password"
              placeholder="At least 8 characters"
              minlength="8"
              maxlength="1024"
              aria-describedby="password-help"
            >
          </label>
          <p id="password-help" class="form-help">
            Use at least 8 characters. New AirGradient work emails will create an account automatically.
          </p>
          <p v-if="props.error" class="form-error">{{ props.error }}</p>
          <button type="submit" class="btn primary">Continue</button>
        </form>

        <button v-else type="button" class="btn primary signin-primary" @click="emit('open')">Sign in</button>
      </article>
    </section>
  </main>
</template>
