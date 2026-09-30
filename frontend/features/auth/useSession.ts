import { ref } from 'vue'
import type { TrackerFetchOptions } from '~/composables/useTrackerApi'
import type { ApiState } from '~/types/api'
import { signInErrorMessage } from '~/utils/auth-error'

export type AuthMode = 'sign-in' | 'register'
export interface AuthCredentials {
  email: string
  password: string
  mode: AuthMode
  displayName?: string
  team?: string
}

export interface SessionDependencies {
  authFetch: (url: string, options?: TrackerFetchOptions) => Promise<unknown>
  saveTabSessionToken: (token?: string) => void
  onAuthenticated: (state: ApiState) => Promise<void> | void
  onLogout: () => Promise<void> | void
}

export function createSession(dependencies: SessionDependencies) {
  const isAuthenticated = ref(false)
  const isRestoringSession = ref(true)
  const signInError = ref('')
  const authMode = ref<AuthMode>('sign-in')

  function selectAuthMode(mode: AuthMode) {
    authMode.value = mode
    signInError.value = ''
  }

  async function restoreSession() {
    if (typeof window === 'undefined') return

    try {
      const next = await dependencies.authFetch('/api/bootstrap') as ApiState
      await dependencies.onAuthenticated(next)
      isAuthenticated.value = true
    } catch {
      isAuthenticated.value = false
    } finally {
      isRestoringSession.value = false
    }
  }

  async function submitAuthentication(credentials: AuthCredentials) {
    signInError.value = ''
    if (!credentials.email.toLowerCase().endsWith('@airgradient.com')) {
      signInError.value = 'Please use your @airgradient.com email.'
      return
    }
    if (!credentials.password) {
      signInError.value = 'Please enter your password.'
      return
    }
    if (credentials.mode === 'register') {
      if (!credentials.displayName?.trim()) {
        signInError.value = 'Please enter your name.'
        return
      }
      if (!credentials.team?.trim()) {
        signInError.value = 'Please choose your team.'
        return
      }
    }

    try {
      const next = await dependencies.authFetch('/api/session', {
        method: 'POST',
        body: credentials
      }) as ApiState
      dependencies.saveTabSessionToken(next.sessionToken)
      await dependencies.onAuthenticated(next)
      isAuthenticated.value = true
    } catch (error) {
      signInError.value = signInErrorMessage(error)
    }
  }

  async function logout() {
    await dependencies.authFetch('/api/session', { method: 'DELETE' }).catch(() => null)
    dependencies.saveTabSessionToken('')
    await dependencies.onLogout()
    isAuthenticated.value = false
    authMode.value = 'sign-in'
    signInError.value = ''
  }

  return {
    isAuthenticated,
    isRestoringSession,
    logout,
    authMode,
    restoreSession,
    selectAuthMode,
    signInError,
    submitAuthentication
  }
}

export function useSession(dependencies: SessionDependencies) {
  return createSession(dependencies)
}
