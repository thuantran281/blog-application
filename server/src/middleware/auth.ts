import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../config/auth.js'
import type { AuthUser, UserRole } from '../types/auth.js'
import { HttpError } from './error.js'

const ROLES: UserRole[] = ['admin', 'member', 'viewer']

function isRole(value: unknown): value is UserRole {
  return typeof value === 'string' && ROLES.includes(value as UserRole)
}

function parseAuthUser(header: string | undefined): AuthUser | null {
  if (!header) {
    return null
  }

  if (!header.startsWith('Bearer ')) {
    throw new HttpError(401, 'Invalid authorization header')
  }

  const token = header.slice('Bearer '.length).trim()

  if (!token) {
    throw new HttpError(401, 'Authentication required')
  }

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
    !isRole(payload.role)
  ) {
    throw new HttpError(401, 'Invalid or expired token')
  }

  return {
    id: payload.sub,
    username: payload.username,
    email: payload.email,
    role: payload.role,
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = parseAuthUser(req.headers.authorization)

  if (!user) {
    throw new HttpError(401, 'Authentication required')
  }

  req.user = user
  next()
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = getAuthUser(req)

  if (user.role !== 'admin') {
    throw new HttpError(403, 'Admin access required')
  }

  next()
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const user = parseAuthUser(req.headers.authorization)

  if (user) {
    req.user = user
  }

  next()
}

export function getAuthUser(req: Request): AuthUser {
  if (!req.user) {
    throw new HttpError(401, 'Authentication required')
  }

  return req.user
}
