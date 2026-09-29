export type BreezyVerbosity = 'quiet' | 'gentle' | 'chatty'

export interface AccountSettingsInput {
  profile: {
    displayName: string
    team: string
  }
  settings: {
    idleThresholdMinutes: number
    nudgeCadenceMinutes: number
    breezyVerbosity: BreezyVerbosity
    muted: boolean
    locationEnabled: boolean
    activityEnabled: boolean
    locationLabels: string[]
  }
}
