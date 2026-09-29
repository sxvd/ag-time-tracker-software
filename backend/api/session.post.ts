import { canCreateAccount, hashPassword, passwordPolicyError, setSessionCookie, verifyPassword } from '../utils/auth'
import { prisma } from '../utils/prisma'
import { publicState } from '../utils/store'
import { requiredString } from '../utils/validation'

function displayNameFromEmail(email: string) {
  return email
    .split('@')[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'AirGradient User'
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Record<string, unknown>>(event)
  const email = requiredString('email', body.email, { max: 254 }).toLowerCase()
  const password = typeof body.password === 'string' ? body.password : ''
  if (!email.endsWith('@airgradient.com')) {
    throw createError({ statusCode: 401, statusMessage: 'Use an AirGradient work email.' })
  }
  if (!password) {
    throw createError({ statusCode: 400, statusMessage: 'Password is required.' })
  }
  if (password.length > 1_024) {
    throw createError({ statusCode: 400, statusMessage: 'Password is too long.' })
  }
  const passwordError = passwordPolicyError(password)
  if (passwordError) {
    throw createError({ statusCode: 400, statusMessage: passwordError })
  }

  let user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    const config = useRuntimeConfig(event)
    const allowSelfRegistration = ['true', '1'].includes(String(config.allowSelfRegistration).toLowerCase())
    if (!canCreateAccount(allowSelfRegistration)) {
      throw createError({ statusCode: 401, statusMessage: 'Account is not provisioned.' })
    }
    user = await prisma.user.create({
      data: {
        email,
        displayName: displayNameFromEmail(email),
        team: 'Software',
        passwordHash: await hashPassword(password)
      }
    })
  } else if (!user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password.' })
  }

  const sessionToken = await setSessionCookie(event, user.id)
  return { ...(await publicState(user.id)), sessionToken }
})
