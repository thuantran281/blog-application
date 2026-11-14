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

function signToken(user: User): string {
  return jwt.sign({ username: user.username, email: user.email, role: user.role }, JWT_SECRET, {
    subject: user.id,
    expiresIn: JWT_EXPIRES_IN,
  })
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

  const token = signToken(user)
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

  const token = signToken(user)
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

export function logout(req: Request, res: Response) {
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
