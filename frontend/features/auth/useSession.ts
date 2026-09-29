import { ref } from 'vue'
import type { TrackerFetchOptions } from '~/composables/useTrackerApi'
import type { ApiState } from '~/types/api'
import { signInErrorMessage } from '~/utils/auth-error'

export interface SessionDependencies {
  authFetch: (url: string, options?: TrackerFetchOptions) => Promise<unknown>
  saveTabSessionToken: (token?: string) => void
  onAuthenticated: (state: ApiState) => Promise<void> | void
  onLogout: () => Promise<void> | void
}

export function createSession(dependencies: SessionDependencies) {
  const isAuthenticated = ref(false)
  const isRestoringSession = ref(true)
  const showSignIn = ref(false)
  const signInError = ref('')

  function openSignIn() {
    showSignIn.value = true
  }

  async function restoreSession() {
    if (typeof window === 'undefined') return

    try {
      const next = await dependencies.authFetch('/api/bootstrap') as ApiState
      await dependencies.onAuthenticated(next)
      isAuthenticated.value = true
      showSignIn.value = false
    } catch {
      isAuthenticated.value = false
    } finally {
      isRestoringSession.value = false
    }
  }

  async function submitSignIn(credentials: { email: string, password: string }) {
    signInError.value = ''
    if (!credentials.email.toLowerCase().endsWith('@airgradient.com')) {
      signInError.value = 'Please use your @airgradient.com email.'
      return
    }
    if (!credentials.password) {
      signInError.value = 'Please enter your password.'
      return
    }

    try {
      const next = await dependencies.authFetch('/api/session', {
        method: 'POST',
        body: credentials
      }) as ApiState
      dependencies.saveTabSessionToken(next.sessionToken)
      await dependencies.onAuthenticated(next)
      isAuthenticated.value = true
      showSignIn.value = false
    } catch (error) {
      signInError.value = signInErrorMessage(error)
    }
  }

  async function logout() {
    await dependencies.authFetch('/api/session', { method: 'DELETE' }).catch(() => null)
    dependencies.saveTabSessionToken('')
    await dependencies.onLogout()
    isAuthenticated.value = false
    showSignIn.value = false
    signInError.value = ''
  }

  return {
    isAuthenticated,
    isRestoringSession,
    logout,
    openSignIn,
    restoreSession,
    showSignIn,
    signInError,
    submitSignIn
  }
}

export function useSession(dependencies: SessionDependencies) {
  return createSession(dependencies)
}
