import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../config/auth.js'
import { SESSION_COOKIE, readCookie } from '../lib/cookies.js'
import { isSessionActive } from '../services/session.service.js'
import type { AuthUser, UserRole } from '../types/auth.js'
import { HttpError } from './error.js'

const ROLES: UserRole[] = ['admin', 'member', 'viewer']
const UNAUTHENTICATED_AUTH_PATHS = new Set(['/api/auth/login', '/api/auth/register'])

function isRole(value: unknown): value is UserRole {
  return typeof value === 'string' && ROLES.includes(value as UserRole)
}

interface ParsedToken {
  user: AuthUser
  sessionId: string
}

function parseToken(token: string): ParsedToken {
  let payload: string | jwt.JwtPayload

  try {
    payload = jwt.verify(token, JWT_SECRET)
  } catch {
    throw new HttpError(401, 'Invalid or expired token')
  }

  if (
    typeof payload === 'string' ||
    typeof payload.sub !== 'string' ||
    typeof payload.username !== 'string' ||
    typeof payload.email !== 'string' ||
    typeof payload.sid !== 'string' ||
    !isRole(payload.role)
  ) {
    throw new HttpError(401, 'Invalid or expired token')
  }

  return {
    user: {
      id: payload.sub,
      username: payload.username,
      email: payload.email,
      role: payload.role,
    },
    sessionId: payload.sid,
  }
}

function parseAuthorizationHeader(header: string): ParsedToken {
  if (!header.startsWith('Bearer ')) {
    throw new HttpError(401, 'Invalid authorization header')
  }

  const token = header.slice('Bearer '.length).trim()

  if (!token) {
    throw new HttpError(401, 'Authentication required')
  }

  return parseToken(token)
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const pathname = req.originalUrl.split('?')[0] ?? ''

  if (UNAUTHENTICATED_AUTH_PATHS.has(pathname)) {
    next()
    return
  }

  const header = req.headers.authorization

  if (header) {
    const parsed = parseAuthorizationHeader(header)

    if (!(await isSessionActive(parsed.sessionId, parsed.user.id))) {
      throw new HttpError(401, 'Invalid or expired token')
    }

    req.user = parsed.user
    req.sessionId = parsed.sessionId
    req.authSource = 'bearer'
    next()
    return
  }

  const token = readCookie(req, SESSION_COOKIE)

  if (!token) {
    next()
    return
  }

  let parsed: ParsedToken

  try {
    parsed = parseToken(token)
  } catch {
    next()
    return
  }

  if (await isSessionActive(parsed.sessionId, parsed.user.id)) {
    req.user = parsed.user
    req.sessionId = parsed.sessionId
    req.authSource = 'cookie'
  }

  next()
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    throw new HttpError(401, 'Authentication required')
  }

  next()
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = getAuthUser(req)

  if (user.role !== 'admin') {
    throw new HttpError(403, 'Admin access required')
  }

  next()
}

export function getAuthUser(req: Request): AuthUser {
  if (!req.user) {
    throw new HttpError(401, 'Authentication required')
  }

  return req.user
}
