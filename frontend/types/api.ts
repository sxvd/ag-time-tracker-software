import type { AccountSettingsInput } from '~~/shared/types/account-settings'
import type { EfficiencyFeel, EnergyLevel, FlowQuality, PauseWindow } from '~~/shared/utils/time'

export interface ApiUser {
  id: string
  email: string
  displayName: string
  team: string
}

export interface ApiCollaborator {
  id: string
  displayName: string
  team: string
}

export interface ApiInvitation {
  id: string
  taskId: string
  senderId: string
  recipientId: string
  status: 'pending' | 'accepted'
  createdAt: string
  respondedAt?: string
}

export interface ApiCategory {
  id: string
  ownerId: string | null
  name: string
}

export interface ApiClient {
  id: string
  name: string
}

export interface ApiProject {
  id: string
  clientId: string
  name: string
  description: string
}

export interface ApiTask {
  id: string
  title: string
  description: string
  categoryId: string
  clientId?: string
  projectId?: string
  ownerId: string
  isShared: boolean
  isArchived: boolean
  createdAt: string
  members: string[]
}

export interface ApiPauseWindow extends PauseWindow {
  durationSeconds: number | null
}

export interface ApiEntryFeedback {
  flowQuality: FlowQuality
  efficiencyFeel: EfficiencyFeel
  energy: EnergyLevel
  note: string
}

export interface ApiEntry {
  id: string
  taskId: string
  userId: string
  startedAt: string
  endedAt: string | null
  durationSeconds: number
  isManual: boolean
  isEdited: boolean
  idleSeconds: number
  excludedIdleSeconds: number
  contextSwitches: number
  locationLabel: string
  pauses: ApiPauseWindow[]
  feedback?: ApiEntryFeedback
  blockers: string[]
  createdAt: string
}

export interface ApiSharedTaskMember {
  userId: string
  displayName: string
  role: 'owner' | 'member'
}

export interface ApiSharedTaskEffort {
  taskId: string
  taskTitle: string
  myDurationSeconds: number
  members: ApiSharedTaskMember[]
}

export type ApiSettings = AccountSettingsInput['settings']

export interface ApiHoursMetric {
  name: string
  hours: number
  seconds: number
}

export interface ApiCountMetric {
  name: string
  count: number
}

export interface ApiBlockerMetric {
  name: string
  count: number
  hours: number
}

export interface ApiTrendMetric {
  name: string
  value: number
}

export interface ApiPersonalDaySeriesMetric {
  name: string
  hours: number
  seconds: number
  sessions: number
}

export interface ApiPersonalDashboardDay {
  date: string
  label: string
  byCategory: ApiPersonalDaySeriesMetric[]
  byTask: ApiPersonalDaySeriesMetric[]
  byFlow: ApiPersonalDaySeriesMetric[]
}

export interface ApiPersonalDashboardWeek {
  weekStart: string
  weekEnd: string
  label: string
  totalSeconds: number
  days: ApiPersonalDashboardDay[]
  blockers: ApiBlockerMetric[]
  efficiency: ApiCountMetric[]
  energy: ApiCountMetric[]
}

export interface ApiPersonalDashboard {
  totalHours: number
  totalSeconds: number
  byCategory: ApiHoursMetric[]
  byTask: ApiHoursMetric[]
  blockers: ApiBlockerMetric[]
  flow: ApiCountMetric[]
  efficiency: ApiCountMetric[]
  energy: ApiCountMetric[]
  trend: ApiTrendMetric[]
  weeks?: ApiPersonalDashboardWeek[]
}

export interface ApiCompanyDashboard {
  categoryId: string | null
  availableCategories: Array<{ id: string, name: string }>
  week: {
    start: string
    end: string
    label: string
  }
  totalSeconds: number
  activeSharedSessionCount: number
  overview: {
    metric: 'trackedTime' | 'sessions' | 'contextSwitches'
    groupBy: 'category' | 'flow' | 'efficiency'
    days: Array<{
      date: string
      label: string
      series: Array<{ name: string, value: number }>
    }>
  }
  blockers: ApiBlockerMetric[]
  flow: ApiCountMetric[]
  efficiency: ApiCountMetric[]
}

export interface ApiDashboards {
  personal: ApiPersonalDashboard
}

export interface ApiJourneyDay {
  date: string
  mood: string
  airClarityScore: number
  hours: number
  weekLabel: string
}

export interface ApiMedal {
  code: string
  name: string
  description: string
  awarded: boolean
}

export type BreezyNudgeType = 'long-focus' | 'hydration' | 'ventilation'

export interface ApiBreezyNudge {
  id: string
  relatedEntryId: string
  type: BreezyNudgeType
  message: string
  shownAt: string
  acknowledgedAt: string | null
}

export interface ApiState {
  user: ApiUser
  sessionToken?: string
  users: ApiCollaborator[]
  signedInUsers: ApiCollaborator[]
  taskInvitations: ApiInvitation[]
  categories: ApiCategory[]
  clients: ApiClient[]
  projects: ApiProject[]
  blockers: string[]
  tasks: ApiTask[]
  entries: ApiEntry[]
  sharedTaskEffort: ApiSharedTaskEffort[]
  breezyNudges: ApiBreezyNudge[]
  settings: ApiSettings
  dashboards: ApiDashboards
  journey: ApiJourneyDay[]
  medals: ApiMedal[]
}
