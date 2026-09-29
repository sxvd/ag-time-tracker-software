<script setup lang="ts">
import type { ThemePreference } from '~~/shared/utils/theme'

defineProps<{
  user: { displayName: string, email: string, team: string }
  initials: string
  themePreference: ThemePreference
}>()

const emit = defineEmits<{
  openSettings: []
  logout: []
  themeChange: [preference: ThemePreference]
}>()

const isOpen = ref<boolean>(false)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const panelId = useId()

function addDocumentListeners() {
  if (typeof document === 'undefined') return
  document.addEventListener('keydown', handleDocumentKeydown)
  document.addEventListener('pointerdown', handleDocumentPointerDown)
}

function removeDocumentListeners() {
  if (typeof document === 'undefined') return
  document.removeEventListener('keydown', handleDocumentKeydown)
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
}

function openPopover() {
  if (isOpen.value) return
  isOpen.value = true
  addDocumentListeners()
}

function closePopover(restoreFocus = true) {
  if (!isOpen.value) return
  isOpen.value = false
  removeDocumentListeners()
  if (restoreFocus) nextTick(() => trigger.value?.focus())
}

function togglePopover() {
  if (isOpen.value) closePopover()
  else openPopover()
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.preventDefault()
  closePopover()
}

function handleDocumentPointerDown(event: Event) {
  if (root.value?.contains(event.target as Node)) return
  closePopover()
}

function requestSettings() {
  closePopover(false)
  emit('openSettings')
}

function requestLogout() {
  closePopover(false)
  emit('logout')
}

onBeforeUnmount(removeDocumentListeners)
</script>

<template>
  <div ref="root" class="account-menu">
    <button
      ref="trigger"
      type="button"
      class="account-trigger"
      aria-haspopup="dialog"
      :aria-controls="panelId"
      :aria-expanded="isOpen"
      @click="togglePopover"
      @keydown.enter.prevent="openPopover"
      @keydown.space.prevent="openPopover"
    >
      <span class="avatar" aria-hidden="true">{{ initials }}</span>
      <span class="account-trigger-identity">
        <span class="account-name">{{ user.displayName }}</span>
        <span class="account-team">{{ user.team }}</span>
      </span>
      <span class="account-chevron" aria-hidden="true">›</span>
    </button>

    <section
      v-if="isOpen"
      :id="panelId"
      class="account-popover"
      role="dialog"
      aria-label="Account"
    >
      <header class="account-identity">
        <strong>{{ user.displayName }}</strong>
        <span>{{ user.email }}</span>
        <span>{{ user.team }}</span>
      </header>

      <button
        type="button"
        class="account-action"
        data-testid="open-settings"
        @click="requestSettings"
      >
        <span>Settings</span>
        <span aria-hidden="true">›</span>
      </button>

      <fieldset class="theme-fieldset">
        <legend>Theme</legend>
        <div class="theme-options" role="radiogroup" aria-label="Theme preference">
          <button
            v-for="preference in (['system', 'light', 'dark'] as const)"
            :key="preference"
            type="button"
            role="radio"
            :aria-checked="themePreference === preference"
            :class="{ selected: themePreference === preference }"
            :data-testid="`theme-${preference}`"
            @click="emit('themeChange', preference)"
          >
            {{ preference[0]?.toUpperCase() }}{{ preference.slice(1) }}
          </button>
        </div>
      </fieldset>

      <button
        type="button"
        class="account-action logout-action"
        data-testid="logout"
        @click="requestLogout"
      >
        Log out
      </button>
    </section>
  </div>
</template>

<style scoped>
.account-menu {
  position: relative;
  width: 100%;
}

.account-trigger {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 10px;
  border-radius: var(--radius);
  padding: 8px;
  text-align: left;
}

.account-trigger:hover,
.account-trigger[aria-expanded="true"] {
  background: var(--surface-2);
}

.account-trigger-identity {
  display: grid;
  min-width: 0;
}

.account-name,
.account-team {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-name {
  color: var(--text);
  font-size: 13.5px;
  font-weight: 800;
  line-height: 1.15;
}

.account-team {
  color: var(--text-mut);
  font-size: 11.5px;
}

.account-chevron {
  margin-left: auto;
  color: var(--text-mut);
  font-size: 20px;
}

.account-popover {
  position: absolute;
  z-index: 30;
  left: 0;
  bottom: calc(100% + 8px);
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: var(--shadow-lg);
  color: var(--text);
  overflow: hidden;
}

.account-identity {
  display: grid;
  padding: 14px 16px;
}

.account-identity strong {
  font-size: 14px;
}

.account-identity span {
  color: var(--text-mut);
  font-size: 12px;
  overflow-wrap: anywhere;
}

.account-action {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--border);
  padding: 11px 16px;
  text-align: left;
}

.account-action:hover {
  background: var(--surface-2);
}

.theme-fieldset {
  margin: 0;
  border: 0;
  border-top: 1px solid var(--border);
  padding: 11px 16px 14px;
}

.theme-fieldset legend {
  padding-top: 11px;
  color: var(--text-mut);
  font-size: 12px;
  font-weight: 800;
}

.theme-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  border-radius: 8px;
  background: var(--surface-2);
  padding: 3px;
}

.theme-options button {
  border-radius: 6px;
  color: var(--text-mid);
  font-size: 12px;
  font-weight: 700;
  padding: 6px 4px;
}

.theme-options button.selected {
  background: var(--surface);
  color: var(--ag-blue);
  box-shadow: var(--shadow-sm);
}

.logout-action {
  color: var(--red);
}
</style>
