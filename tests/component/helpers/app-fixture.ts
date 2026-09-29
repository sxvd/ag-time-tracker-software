import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { vi } from 'vitest'
import type { ApiCompanyDashboard, ApiState } from '../../../frontend/types/api'
import App from '../../../frontend/app.vue'

export type AppStateFixture = ApiState

export type FixtureFetch = ReturnType<typeof vi.fn<(url: string, options?: Record<string, unknown>) => Promise<unknown>>>

export function createCompanyDashboardFixture(overrides: Partial<ApiCompanyDashboard> = {}): ApiCompanyDashboard {
  return {
    categoryId: null,
    availableCategories: [
      { id: 'category-deep-work', name: 'Deep work' },
      { id: 'category-meeting', name: 'Meeting' },
      { id: 'category-admin', name: 'Admin' }
    ],
    week: { start: '2026-08-24', end: '2026-08-30', label: 'Aug 24–30, 2026' },
    totalSeconds: 6_600,
    activeSharedSessionCount: 1,
    overview: {
      metric: 'trackedTime',
      groupBy: 'category',
      days: [
        { date: '2026-08-24', label: 'Mon 24', series: [{ name: 'Deep work', value: 4_200 }, { name: 'Meeting', value: 2_400 }] },
        ...['Tue 25', 'Wed 26', 'Thu 27', 'Fri 28', 'Sat 29', 'Sun 30'].map((label, index) => ({
          date: `2026-08-${25 + index}`,
          label,
          series: []
        }))
      ]
    },
    blockers: [{ name: 'Waiting on someone', count: 1, hours: 0.7 }],
    flow: [{ name: 'Great flow', count: 1 }, { name: 'Neutral', count: 1 }],
    efficiency: [{ name: 'Felt efficient', count: 1 }, { name: 'Felt manual', count: 1 }],
    ...overrides
  }
}

export function createAppFixture(overrides: Partial<AppStateFixture> = {}): AppStateFixture {
  const fixture: AppStateFixture = {
    user: {
      id: 'u1',
      email: 'mog@airgradient.com',
      displayName: 'Mog',
      team: 'Software'
    },
    sessionToken: 'fixture-tab-session-token',
    users: [
      { id: 'u1', displayName: 'Mog', team: 'Software' },
      { id: 'u2', displayName: 'Jack', team: 'Hardware' },
      { id: 'u3', displayName: 'Jay', team: 'Communication' }
    ],
    signedInUsers: [
      { id: 'u1', displayName: 'Mog', team: 'Software' },
      { id: 'u2', displayName: 'Jack', team: 'Hardware' }
    ],
    taskInvitations: [
      {
        id: 'invite-1',
        taskId: 'task-invited',
        senderId: 'u2',
        recipientId: 'u1',
        status: 'pending',
        createdAt: '2026-08-25T01:45:00.000Z'
      }
    ],
    categories: [
      { id: 'category-deep-work', ownerId: null, name: 'Deep work' },
      { id: 'category-meeting', ownerId: null, name: 'Meeting' },
      { id: 'category-admin', ownerId: null, name: 'Admin' }
    ],
    clients: [{ id: 'cl1', name: 'AirGradient' }],
    projects: [
      {
        id: 'p1',
        clientId: 'cl1',
        name: 'Breezy Time Tracker',
        description: 'Internal focus and process insight.'
      }
    ],
    blockers: [
      'Waiting on someone',
      'Tool was slow or broke',
      'Unclear requirements',
      'Interruptions',
      'Context switching',
      'Meetings overran',
      'None'
    ],
    tasks: [
      {
        id: 'task-active',
        title: 'Production readiness review',
        description: 'Verify the current production-readiness evidence.',
        categoryId: 'category-deep-work',
        clientId: 'cl1',
        projectId: 'p1',
        ownerId: 'u1',
        isShared: true,
        isArchived: false,
        createdAt: '2026-08-24T08:00:00.000Z',
        members: ['u1', 'u2']
      },
      {
        id: 'task-invited',
        title: 'Sensor QA handoff',
        description: 'Review the shared validation notes.',
        categoryId: 'category-meeting',
        clientId: 'cl1',
        projectId: 'p1',
        ownerId: 'u2',
        isShared: true,
        isArchived: false,
        createdAt: '2026-08-24T07:00:00.000Z',
        members: ['u2']
      }
    ],
    entries: [
      {
        id: 'entry-active',
        taskId: 'task-active',
        userId: 'u1',
        startedAt: '2026-08-25T03:00:00.000Z',
        endedAt: null,
        durationSeconds: 0,
        isManual: false,
        isEdited: false,
        idleSeconds: 120,
        excludedIdleSeconds: 30,
        contextSwitches: 2,
        locationLabel: 'Home office',
        pauses: [
          {
            startedAt: '2026-08-25T03:20:00.000Z',
            endedAt: '2026-08-25T03:25:00.000Z',
            durationSeconds: 300
          }
        ],
        blockers: [],
        createdAt: '2026-08-25T03:00:00.000Z'
      },
      {
        id: 'entry-completed',
        taskId: 'task-active',
        userId: 'u1',
        startedAt: '2026-08-24T03:00:00.000Z',
        endedAt: '2026-08-24T04:15:00.000Z',
        durationSeconds: 4200,
        isManual: false,
        isEdited: true,
        idleSeconds: 300,
        excludedIdleSeconds: 0,
        contextSwitches: 1,
        locationLabel: 'Home office',
        pauses: [],
        feedback: {
          flowQuality: 'Great flow',
          efficiencyFeel: 'Felt efficient',
          energy: 'High',
          note: 'Clear review pass.'
        },
        blockers: ['None'],
        createdAt: '2026-08-24T03:00:00.000Z'
      }
    ],
    sharedTaskEffort: [
      {
        taskId: 'task-active',
        taskTitle: 'Production readiness review',
        myDurationSeconds: 4200,
        members: [
          { userId: 'u1', displayName: 'Mog', role: 'owner' },
          { userId: 'u2', displayName: 'Jack', role: 'member' }
        ]
      }
    ],
    breezyNudges: [],
    settings: {
      idleThresholdMinutes: 5,
      nudgeCadenceMinutes: 50,
      breezyVerbosity: 'gentle',
      muted: false,
      locationEnabled: false,
      activityEnabled: true,
      locationLabels: ['Home office', 'AirGradient office']
    },
    dashboards: {
      personal: {
        totalHours: 1.2,
        totalSeconds: 4200,
        byCategory: [{ name: 'Deep work', hours: 1.2, seconds: 4200 }],
        byTask: [{ name: 'Production readiness review', hours: 1.2, seconds: 4200 }],
        blockers: [{ name: 'Waiting on someone', count: 1, hours: 0.7 }],
        flow: [{ name: 'Great flow', count: 1 }],
        efficiency: [{ name: 'Felt efficient', count: 1 }],
        energy: [{ name: 'High', count: 1 }],
        trend: [{ name: 'Aug 23', value: 1.2 }],
        weeks: [{
          weekStart: '2026-08-24',
          weekEnd: '2026-08-30',
          label: 'Aug 24–30, 2026',
          totalSeconds: 4200,
          days: [
            {
              date: '2026-08-24',
              label: 'Mon 24',
              byCategory: [{ name: 'Deep work', hours: 1.2, seconds: 4200, sessions: 1 }],
              byTask: [{ name: 'Production readiness review', hours: 1.2, seconds: 4200, sessions: 1 }],
              byFlow: [{ name: 'Great flow', hours: 1.2, seconds: 4200, sessions: 1 }]
            },
            ...['Tue 25', 'Wed 26', 'Thu 27', 'Fri 28', 'Sat 29', 'Sun 30'].map((label, index) => ({
              date: `2026-08-${25 + index}`,
              label,
              byCategory: [],
              byTask: [],
              byFlow: []
            }))
          ],
          blockers: [{ name: 'Waiting on someone', count: 1, hours: 0.7 }],
          efficiency: [{ name: 'Felt efficient', count: 1 }],
          energy: [{ name: 'High', count: 1 }]
        }]
      }
    },
    journey: [
      { date: '2026-08-11', mood: 'happy', airClarityScore: 82, hours: 1.1, weekLabel: 'August week 1' },
      { date: '2026-08-18', mood: 'cheering', airClarityScore: 91, hours: 1.2, weekLabel: 'August week 2' }
    ],
    medals: [
      { code: 'flow-state', name: 'Flow State', description: 'Logged a great-flow session.', awarded: true },
      { code: 'steady-breeze', name: 'Steady Breeze', description: 'Tracked across five sessions.', awarded: false }
    ]
  }

  return cloneFixture({ ...fixture, ...overrides })
}

export async function mountTrackerApp(options: {
  state?: AppStateFixture
  fetchMock?: FixtureFetch
} = {}) {
  const state = cloneFixture(options.state || createAppFixture())
  const companyDashboard = createCompanyDashboardFixture()
  const fetchMock = options.fetchMock || vi.fn(async (url: string) => {
    if (url.endsWith('/api/bootstrap')) return cloneFixture(state)
    if (url.includes('/api/company-dashboard')) return cloneFixture(companyDashboard)
    throw new Error(`Unexpected request: ${url}`)
  })

  vi.stubGlobal('$fetch', fetchMock)
  const wrapper = await mountSuspended(App, { attachTo: document.body })
  await flushPromises()

  return { wrapper, fetchMock, state }
}

function cloneFixture<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
