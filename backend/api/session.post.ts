import { canCreateAccount, hashPassword, passwordPolicyError, setSessionCookie, verifyPassword } from '../utils/auth'
import { prisma } from '../utils/prisma'
import { publicState } from '../utils/store'
import { DEFAULT_CATEGORY_NAMES } from '../../shared/constants/categories.mjs'
import { enumValue, requiredString } from '../utils/validation'

export default defineEventHandler(async (event) => {
  const body = await readBody<Record<string, unknown>>(event)
  const email = requiredString('email', body.email, { max: 254 }).toLowerCase()
  const password = typeof body.password === 'string' ? body.password : ''
  const mode = body.mode === 'register' ? 'register' : body.mode === 'sign-in' || body.mode === undefined ? 'sign-in' : null
  if (!mode) {
    throw createError({ statusCode: 400, statusMessage: 'Choose sign in or register.' })
  }
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
  if (mode === 'register') {
    if (user) {
      throw createError({ statusCode: 409, statusMessage: 'Account already exists. Sign in instead.' })
    }
    const config = useRuntimeConfig(event)
    const allowSelfRegistration = ['true', '1'].includes(String(config.allowSelfRegistration).toLowerCase())
    if (!canCreateAccount(allowSelfRegistration)) {
      throw createError({ statusCode: 403, statusMessage: 'Registration is currently unavailable.' })
    }
    const displayName = requiredString('displayName', body.displayName, { max: 100 })
    const team = enumValue('team', body.team, DEFAULT_CATEGORY_NAMES)
    user = await prisma.user.create({
      data: {
        email,
        displayName,
        team,
        passwordHash: await hashPassword(password)
      }
    })
  } else if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password.' })
  }

  const sessionToken = await setSessionCookie(event, user.id)
  return { ...(await publicState(user.id)), sessionToken }
})
