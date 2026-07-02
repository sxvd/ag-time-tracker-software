import { hashPassword, setSessionCookie, verifyPassword } from '../utils/auth'
import { prisma } from '../utils/prisma'
import { publicState } from '../utils/store'

function displayNameFromEmail(email: string) {
  return email
    .split('@')[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'AirGradient User'
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email: string, password: string }>(event)
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  if (!email.endsWith('@airgradient.com')) {
    throw createError({ statusCode: 401, statusMessage: 'Use an AirGradient work email.' })
  }
  if (!password) {
    throw createError({ statusCode: 400, statusMessage: 'Password is required.' })
  }

  let user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        displayName: displayNameFromEmail(email),
        team: 'Software',
        passwordHash: await hashPassword(password)
      }
    })
  } else if (!(await verifyPassword(password, user.passwordHash))) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password.' })
  }

  const sessionToken = await setSessionCookie(event, user.id)
  return { ...(await publicState(user.id)), sessionToken }
})
