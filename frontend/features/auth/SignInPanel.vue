<script setup lang="ts">
import { DEFAULT_CATEGORY_NAMES } from '~~/shared/constants/categories.mjs'
import { withAppBase } from '~~/shared/utils/url'
import type { AuthMode } from './useSession'

const props = withDefaults(defineProps<{
  restoring: boolean
  error?: string
  mode?: AuthMode
}>(), {
  error: '',
  mode: 'sign-in'
})

const emit = defineEmits<{
  selectMode: [mode: AuthMode]
  submit: [credentials: { email: string, password: string, mode: AuthMode, displayName?: string, team?: string }]
}>()

const email = ref('')
const password = ref('')
const displayName = ref('')
const team = ref(DEFAULT_CATEGORY_NAMES[0])
const teams = DEFAULT_CATEGORY_NAMES
const logoUrl = withAppBase(useRuntimeConfig().app.baseURL, '/airgradient-logo.svg')

function submit() {
  const base = {
    email: email.value.trim(),
    password: password.value,
    mode: props.mode
  }
  if (props.mode === 'register') {
    emit('submit', {
      ...base,
      displayName: displayName.value.trim(),
      team: team.value
    })
    return
  }
  emit('submit', {
    ...base
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
        <p class="eyebrow">AirGradient account</p>
        <h2>{{ props.mode === 'sign-in' ? 'Sign in to continue' : 'Create your account' }}</h2>

        <div class="auth-mode-toggle" role="tablist" aria-label="Choose account access">
          <button
            type="button"
            role="tab"
            :aria-selected="props.mode === 'sign-in'"
            :class="{ active: props.mode === 'sign-in' }"
            @click="emit('selectMode', 'sign-in')"
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="props.mode === 'register'"
            :class="{ active: props.mode === 'register' }"
            @click="emit('selectMode', 'register')"
          >
            Register
          </button>
        </div>

        <form class="signin-form" @submit.prevent="submit">
          <label>
            Work email
            <input v-model.trim="email" required type="email" autocomplete="email" placeholder="name@airgradient.com">
          </label>
          <label v-if="props.mode === 'register'">
            Name
            <input v-model.trim="displayName" required type="text" autocomplete="name" placeholder="Your name" maxlength="100">
          </label>
          <label v-if="props.mode === 'register'">
            Team
            <select v-model="team" required autocomplete="organization-title">
              <option v-for="teamName in teams" :key="teamName" :value="teamName">
                {{ teamName }}
              </option>
            </select>
          </label>
          <label>
            Password
            <input
              v-model="password"
              required
              type="password"
              :autocomplete="props.mode === 'sign-in' ? 'current-password' : 'new-password'"
              placeholder="At least 8 characters"
              minlength="8"
              maxlength="1024"
              aria-describedby="password-help"
            >
          </label>
          <p id="password-help" class="form-help">
            {{ props.mode === 'sign-in'
              ? 'Use your existing AirGradient account password (at least 8 characters).'
              : 'Use at least 8 characters to create an account with your AirGradient work email.' }}
          </p>
          <p v-if="props.error" class="form-error">{{ props.error }}</p>
          <button type="submit" class="btn primary">
            {{ props.mode === 'sign-in' ? 'Sign in' : 'Create account' }}
          </button>
        </form>
      </article>
    </section>
  </main>
</template>
