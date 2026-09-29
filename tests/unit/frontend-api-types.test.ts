import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, expectTypeOf, it } from 'vitest'
import type { AccountSettingsInput } from '../../shared/types/account-settings'
import type { PauseWindow } from '../../shared/utils/time'
import type {
  ApiDashboards,
  ApiEntry,
  ApiInvitation,
  ApiJourneyDay,
  ApiMedal,
  ApiPauseWindow,
  ApiState,
  ApiTask
} from '../../frontend/types/api'

describe('frontend API type contract', () => {
  it('publishes one canonical frontend API type module', () => {
    expect(existsSync(resolve(process.cwd(), 'frontend/types/api.ts'))).toBe(true)
  })

  it('keeps active and completed entries distinguishable through endedAt', () => {
    expectTypeOf<ApiEntry['startedAt']>().toEqualTypeOf<string>()
    expectTypeOf<ApiEntry['endedAt']>().toEqualTypeOf<string | null>()
    expectTypeOf<ApiEntry['durationSeconds']>().toEqualTypeOf<number>()
    expectTypeOf<ApiEntry['isManual']>().toEqualTypeOf<boolean>()
    expectTypeOf<ApiEntry['isEdited']>().toEqualTypeOf<boolean>()
    expectTypeOf<ApiEntry['idleSeconds']>().toEqualTypeOf<number>()
    expectTypeOf<ApiEntry['excludedIdleSeconds']>().toEqualTypeOf<number>()
    expectTypeOf<ApiEntry['contextSwitches']>().toEqualTypeOf<number>()
  })

  it('preserves pause, feedback, settings, invitation, and task shapes', () => {
    expectTypeOf<ApiEntry['pauses']>().toEqualTypeOf<ApiPauseWindow[]>()
    expectTypeOf<ApiPauseWindow>().toMatchTypeOf<PauseWindow>()
    expectTypeOf<ApiEntry['feedback']>().not.toBeAny()
    expectTypeOf<ApiEntry['blockers']>().toEqualTypeOf<string[]>()
    expectTypeOf<ApiState['settings']>().toEqualTypeOf<AccountSettingsInput['settings']>()
    expectTypeOf<ApiInvitation['status']>().toEqualTypeOf<'pending' | 'accepted'>()
    expectTypeOf<ApiInvitation['respondedAt']>().toEqualTypeOf<string | undefined>()
    expectTypeOf<ApiTask['clientId']>().toEqualTypeOf<string | undefined>()
    expectTypeOf<ApiTask['projectId']>().toEqualTypeOf<string | undefined>()
    expectTypeOf<ApiTask['members']>().toEqualTypeOf<string[]>()
  })

  it('uses named dashboard, Journey, and medal types without any', () => {
    expectTypeOf<ApiState['dashboards']>().toEqualTypeOf<ApiDashboards>()
    expectTypeOf<ApiDashboards['personal']['totalSeconds']>().toEqualTypeOf<number>()
    expectTypeOf<ApiState['journey']>().toEqualTypeOf<ApiJourneyDay[]>()
    expectTypeOf<ApiState['medals']>().toEqualTypeOf<ApiMedal[]>()
    expectTypeOf<ApiDashboards>().not.toBeAny()
    expectTypeOf<ApiJourneyDay>().not.toBeAny()
    expectTypeOf<ApiMedal>().not.toBeAny()
  })
})
