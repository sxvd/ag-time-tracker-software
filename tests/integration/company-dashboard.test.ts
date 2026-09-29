import { createError } from 'h3'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildCompanyDashboard
} from '../../backend/utils/store'
import {
  createEntryFixture,
  createTaskFixture,
  createUser,
  disconnectTestDatabase,
  integrationPrisma,
  resetTestDatabase
} from './helpers/database'

describe('company dashboard aggregate API service', () => {
  beforeAll(() => vi.stubGlobal('createError', createError))
  beforeEach(resetTestDatabase)
  afterAll(disconnectTestDatabase)

  it('uses task categories, selected Monday-Sunday boundaries, and aggregate-only rows', async () => {
    const owner = await createUser({ id: 'company-owner', email: 'company-owner@airgradient.com', displayName: 'Owner', team: 'Legacy team A' })
    const other = await createUser({ id: 'company-other', email: 'company-other@airgradient.com', displayName: 'Other', team: 'Legacy team B' })
    const software = await integrationPrisma.category.create({ data: { id: 'company-software', name: 'Software' } })
    const hardware = await integrationPrisma.category.create({ data: { id: 'company-hardware', name: 'Hardware' } })
    const softwareTask = await createTaskFixture({ id: 'company-software-task', ownerId: owner.id, title: 'Private software task' })
    const hardwareTask = await createTaskFixture({ id: 'company-hardware-task', ownerId: other.id, title: 'Private hardware task' })
    await integrationPrisma.task.update({ where: { id: softwareTask.id }, data: { categoryId: software.id } })
    await integrationPrisma.task.update({ where: { id: hardwareTask.id }, data: { categoryId: hardware.id } })

    const softwareEntry = await createEntryFixture({ id: 'company-software-entry', userId: owner.id, taskId: softwareTask.id, contextSwitches: 3 })
    await integrationPrisma.timeEntry.update({
      where: { id: softwareEntry.id },
      data: {
        durationSeconds: 7_200,
        feedback: { create: { flowQuality: 'Great flow', efficiencyFeel: 'Felt efficient', energy: 'High', note: 'Private note' } }
      }
    })
    await createEntryFixture({ id: 'company-hardware-entry', userId: other.id, taskId: hardwareTask.id, contextSwitches: 5 })
    await integrationPrisma.timeEntry.create({
      data: {
        id: 'company-next-week-entry',
        userId: owner.id,
        taskId: softwareTask.id,
        startedAt: new Date('2026-07-20T09:00:00.000Z'),
        endedAt: new Date('2026-07-20T10:00:00.000Z'),
        durationSeconds: 3_600
      }
    })

    const result = await buildCompanyDashboard({
      categoryId: software.id,
      weekStart: new Date('2026-07-13T00:00:00.000Z'),
      metric: 'contextSwitches',
      groupBy: 'flow'
    })

    expect(result.categoryId).toBe(software.id)
    expect(result.week).toEqual({ start: '2026-07-13', end: '2026-07-19', label: 'Jul 13–19, 2026' })
    expect(result.totalSeconds).toBe(7_200)
    expect(result.overview.days).toHaveLength(7)
    expect(result.overview.days[0]).toMatchObject({
      date: '2026-07-13',
      label: 'Mon 13',
      series: [{ name: 'Great flow', value: 3 }]
    })
    expect(result.overview.days.slice(1).flatMap(day => day.series)).toEqual([])
    expect(result.activeSharedSessionCount).toBe(0)
    expect(JSON.stringify(result)).not.toMatch(/Owner|Other|Private software task|Private note|company-software-entry|Legacy team/i)
  })

  it('defaults to the latest available week and rejects an unknown category before aggregation', async () => {
    const owner = await createUser({ id: 'company-latest-owner', email: 'latest@airgradient.com', displayName: 'Latest owner' })
    const task = await createTaskFixture({ id: 'company-latest-task', ownerId: owner.id })
    await integrationPrisma.timeEntry.create({
      data: {
        id: 'company-latest-entry',
        userId: owner.id,
        taskId: task.id,
        startedAt: new Date('2026-08-20T09:00:00.000Z'),
        endedAt: new Date('2026-08-20T10:00:00.000Z'),
        durationSeconds: 3_600
      }
    })

    await expect(buildCompanyDashboard({
      categoryId: 'missing-category',
      metric: 'trackedTime',
      groupBy: 'category'
    })).rejects.toMatchObject({ statusCode: 400, statusMessage: 'Select an available category.' })

    const result = await buildCompanyDashboard({ metric: 'sessions', groupBy: 'category' })
    expect(result.week.start).toBe('2026-08-17')
    expect(result.overview.days[3]).toMatchObject({ label: 'Thu 20', series: [{ name: 'Test category', value: 1 }] })
  })

  it('caps direct future week requests at the current week', async () => {
    const result = await buildCompanyDashboard({
      weekStart: new Date('2999-01-06T00:00:00.000Z'),
      metric: 'trackedTime',
      groupBy: 'category'
    })

    expect(result.week.start).toBe(currentWeekStartKey())
  })
})

function currentWeekStartKey() {
  const date = new Date()
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const mondayOffset = (utc.getUTCDay() + 6) % 7
  utc.setUTCDate(utc.getUTCDate() - mondayOffset)
  return utc.toISOString().slice(0, 10)
}
