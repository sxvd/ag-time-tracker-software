import type { PauseWindow } from '../../shared/utils/time'

interface ValidationError extends Error {
  statusCode: number
  statusMessage: string
}

function invalid(field: string, reason: string): never {
  const message = `${field} ${reason}`
  const error = new Error(message) as ValidationError
  error.statusCode = 400
  error.statusMessage = message
  throw error
}

export function requiredString(field: string, value: unknown, options: { max: number }) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) invalid(field, 'is required.')
  if (text.length > options.max) invalid(field, `must be at most ${options.max} characters.`)
  return text
}

export function optionalString(field: string, value: unknown, options: { max: number }) {
  if (value === undefined || value === null || value === '') return undefined
  return requiredString(field, value, options)
}

export function boundedInteger(
  field: string,
  value: unknown,
  options: { min: number, max: number }
) {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
    invalid(field, 'must be a finite integer.')
  }
  if (value < options.min || value > options.max) {
    invalid(field, `must be between ${options.min} and ${options.max}.`)
  }
  return value
}

export function optionalBoundedInteger(
  field: string,
  value: unknown,
  options: { min: number, max: number }
) {
  if (value === undefined || value === null || value === '') return undefined
  return boundedInteger(field, value, options)
}

export function booleanValue(field: string, value: unknown) {
  if (typeof value !== 'boolean') invalid(field, 'must be a boolean.')
  return value
}

export function stringArray(
  field: string,
  value: unknown,
  options: { itemMax: number, maxItems: number }
) {
  if (!Array.isArray(value)) invalid(field, 'must be an array.')
  if (value.length > options.maxItems) invalid(field, `must contain at most ${options.maxItems} items.`)
  return [...new Set(value.map((item, index) => requiredString(`${field}[${index}]`, item, { max: options.itemMax })))]
}

export function enumValue<const T extends readonly string[]>(
  field: string,
  value: unknown,
  allowed: T
): T[number] {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    invalid(field, `must be one of: ${allowed.join(', ')}.`)
  }
  return value as T[number]
}

export function isoDate(field: string, value: unknown) {
  if (typeof value !== 'string' || !value.trim()) invalid(field, 'must be an ISO date.')
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) invalid(field, 'must be an ISO date.')
  return date
}

export function pauseWindows(
  field: string,
  value: unknown,
  entryStart: Date,
  entryEnd: Date
): PauseWindow[] {
  if (!Array.isArray(value)) invalid(field, 'must be an array.')

  const pauses = value.map((candidate, index) => {
    if (!candidate || typeof candidate !== 'object') invalid(`${field}[${index}]`, 'must be a pause window.')
    const row = candidate as Record<string, unknown>
    const startedAt = isoDate(`${field}[${index}].startedAt`, row.startedAt)
    const endedAt = isoDate(`${field}[${index}].endedAt`, row.endedAt)
    if (endedAt <= startedAt) invalid(`${field}[${index}]`, 'must end after it starts.')
    if (startedAt < entryStart || endedAt > entryEnd) invalid(`${field}[${index}]`, 'must stay inside the entry.')
    return { startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString() }
  }).sort((left, right) => left.startedAt.localeCompare(right.startedAt))

  for (let index = 1; index < pauses.length; index += 1) {
    if (pauses[index].startedAt < pauses[index - 1].endedAt) invalid(field, 'must not contain overlapping windows.')
  }
  return pauses
}
