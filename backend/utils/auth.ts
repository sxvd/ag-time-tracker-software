import { createHash, createHmac, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { H3Event } from 'h3'
import { prisma } from './prisma'

const scrypt = promisify(scryptCallback)
const cookieName = 'breezy_session'
const maxAgeSeconds = 60 * 60 * 24 * 7

async function derivePasswordKey(password: string, salt: string) {
  return await scrypt(password, salt, 64) as Buffer
}

function sessionSecret(event: H3Event) {
  return useRuntimeConfig(event).sessionPassword || 'dev-session-secret-change-me'
}

function base64Url(input: string) {
  return Buffer.from(input).toString('base64url')
}

function fromBase64Url(input: string) {
  return Buffer.from(input, 'base64url').toString('utf8')
}

function sign(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('base64url')
  const derivedKey = await derivePasswordKey(password, salt)
  return `scrypt$${salt}$${Buffer.from(derivedKey).toString('base64url')}`
}

export async function verifyPassword(password: string, passwordHash: string) {
  const [algorithm, salt, storedKey] = passwordHash.split('$')
  if (algorithm !== 'scrypt' || !salt || !storedKey) return false
  const derivedKey = await derivePasswordKey(password, salt)
  return constantTimeEqual(Buffer.from(derivedKey).toString('base64url'), storedKey)
}

function createSessionToken(event: H3Event, userId: string, sessionId: string, expiresAt: Date) {
  const payload = base64Url(JSON.stringify({
    userId,
    sessionId,
    issuedAt: Date.now(),
    expiresAt: expiresAt.getTime()
  }))
  return `${payload}.${sign(payload, sessionSecret(event))}`
}

export async function setSessionCookie(event: H3Event, userId: string) {
  const sessionId = randomUUID()
  const expiresAt = new Date(Date.now() + maxAgeSeconds * 1000)
  const token = createSessionToken(event, userId, sessionId, expiresAt)
  await prisma.authSession.create({
    data: {
      id: sessionId,
      userId,
      tokenHash: hashToken(token),
      expiresAt
    }
  })

  const forwardedProto = getHeader(event, 'x-forwarded-proto')
  setCookie(event, cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: forwardedProto === 'https' || getRequestURL(event).protocol === 'https:',
    path: '/',
    maxAge: maxAgeSeconds
  })
  return token
}

export function clearSessionCookie(event: H3Event) {
  deleteCookie(event, cookieName, { path: '/' })
}

export async function getSessionUser(event: H3Event) {
  const authHeader = getHeader(event, 'authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : ''
  const token = bearerToken || getCookie(event, cookieName)
  if (!token) return null

  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null

  const expected = sign(payload, sessionSecret(event))
  if (!constantTimeEqual(signature, expected)) return null

  try {
    const decoded = JSON.parse(fromBase64Url(payload)) as { userId?: string, sessionId?: string, expiresAt?: number }
    if (!decoded.userId || !decoded.sessionId || !decoded.expiresAt || decoded.expiresAt < Date.now()) return null

    const session = await prisma.authSession.findFirst({
      where: {
        id: decoded.sessionId,
        userId: decoded.userId,
        tokenHash: hashToken(token),
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      include: { user: true }
    })
    if (!session) return null

    await prisma.authSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() }
    }).catch(() => null)

    return {
      id: session.user.id,
      email: session.user.email,
      displayName: session.user.displayName,
      team: session.user.team
    }
  } catch {
    return null
  }
}

export async function requireSessionUser(event: H3Event) {
  const user = await getSessionUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Please sign in again.' })
  return user
}

export async function revokeUserSessions(userId: string) {
  await prisma.authSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() }
  })
}
