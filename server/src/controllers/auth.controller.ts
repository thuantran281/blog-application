import { randomUUID } from 'node:crypto'
import type { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { JWT_EXPIRES_IN, JWT_SECRET } from '../config/auth.js'
import {
  clearCsrfCookie,
  clearSessionCookie,
  ensureCsrfCookie,
  issueCsrfCookie,
  setSessionCookie,
} from '../lib/cookies.js'
import { getAuthUser } from '../middleware/auth.js'
import { HttpError } from '../middleware/error.js'
import { loginSchema, registerSchema } from '../schemas/auth.schema.js'
import {
  AuthConflictError,
  createUser,
  findUserByEmail,
  findUserById,
  toAuthUser,
  verifyPassword,
  type User,
} from '../services/auth.service.js'
import { createSession, revokeSession } from '../services/session.service.js'

function signToken(user: User, sessionId: string): string {
  return jwt.sign(
    { username: user.username, email: user.email, role: user.role, sid: sessionId },
    JWT_SECRET,
    {
      subject: user.id,
      expiresIn: JWT_EXPIRES_IN,
    },
  )
}

function tokenExpiresAt(token: string): Date {
  const payload = jwt.decode(token)

  if (typeof payload === 'string' || typeof payload?.exp !== 'number') {
    throw new Error('Token is missing an expiration')
  }

  return new Date(payload.exp * 1000)
}

async function createUserSession(user: User): Promise<string> {
  const sessionId = randomUUID()
  const token = signToken(user, sessionId)

  await createSession(sessionId, user.id, tokenExpiresAt(token))

  return token
}

export async function register(req: Request, res: Response) {
  const input = registerSchema.parse(req.body)

  let user: User

  try {
    user = await createUser(input)
  } catch (err) {
    if (err instanceof AuthConflictError) {
      throw new HttpError(409, err.message)
    }

    throw err
  }

  const token = await createUserSession(user)
  setSessionCookie(res, token)
  issueCsrfCookie(res)
  res.setHeader('Cache-Control', 'no-store')
  res.status(201).json({
    data: {
      user: toAuthUser(user),
      token,
    },
  })
}

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body)
  const user = await findUserByEmail(input.email)

  if (!user || !(await verifyPassword(user, input.password))) {
    throw new HttpError(401, 'Invalid email or password')
  }

  const token = await createUserSession(user)
  setSessionCookie(res, token)
  issueCsrfCookie(res)
  res.setHeader('Cache-Control', 'no-store')
  res.json({
    data: {
      user: toAuthUser(user),
      token,
    },
  })
}

export async function me(req: Request, res: Response) {
  const authUser = getAuthUser(req)
  const user = await findUserById(authUser.id)

  if (!user) {
    throw new HttpError(401, 'User no longer exists')
  }

  ensureCsrfCookie(req, res)
  res.setHeader('Cache-Control', 'no-store')
  res.json({ data: toAuthUser(user) })
}

export async function logout(req: Request, res: Response) {
  if (req.user && req.sessionId) {
    await revokeSession(req.sessionId, req.user.id)
  }

  clearSessionCookie(res)
  clearCsrfCookie(res)
  res.setHeader('Cache-Control', 'no-store')
  res.status(204).end()
}

export function csrf(req: Request, res: Response) {
  const token = ensureCsrfCookie(req, res)
  res.setHeader('Cache-Control', 'no-store')
  res.json({ data: { csrfToken: token } })
}
