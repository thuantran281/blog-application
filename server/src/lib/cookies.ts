import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { CookieOptions, Request, Response } from 'express'
import { JWT_EXPIRES_IN } from '../config/auth.js'
import { env } from '../config/env.js'

export const SESSION_COOKIE = 'blog_session'
export const CSRF_COOKIE = 'blog_csrf'
export const CSRF_HEADER = 'X-CSRF-Token'

const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function durationToMs(value: string): number {
  const match = /^(\d+)([smhdw])$/i.exec(value.trim())

  if (match?.[1] && match[2]) {
    const amount = Number(match[1])
    const unit = match[2].toLowerCase()
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
      w: 604_800_000,
    }

    return amount * (multipliers[unit] ?? 1000)
  }

  const seconds = Number(value)

  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : DEFAULT_MAX_AGE_MS
}

const maxAge = durationToMs(String(JWT_EXPIRES_IN))
const secure = env.NODE_ENV === 'production'

const sessionCookieOptions: CookieOptions = {
  httpOnly: true,
  secure,
  sameSite: 'lax',
  path: '/',
  maxAge,
}

const csrfCookieOptions: CookieOptions = {
  secure,
  sameSite: 'lax',
  path: '/',
  maxAge,
}

const clearSessionCookieOptions: CookieOptions = {
  httpOnly: true,
  secure,
  sameSite: 'lax',
  path: '/',
}

const clearCsrfCookieOptions: CookieOptions = {
  secure,
  sameSite: 'lax',
  path: '/',
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie

  if (!header) {
    return null
  }

  for (const part of header.split(';')) {
    const separator = part.indexOf('=')

    if (separator < 0) {
      continue
    }

    if (part.slice(0, separator).trim() !== name) {
      continue
    }

    const value = part.slice(separator + 1).trim()

    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }

  return null
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions)
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, clearSessionCookieOptions)
}

export function issueCsrfCookie(res: Response): string {
  const token = randomBytes(32).toString('hex')
  res.cookie(CSRF_COOKIE, token, csrfCookieOptions)
  return token
}

export function ensureCsrfCookie(req: Request, res: Response): string {
  return readCookie(req, CSRF_COOKIE) ?? issueCsrfCookie(res)
}

export function clearCsrfCookie(res: Response): void {
  res.clearCookie(CSRF_COOKIE, clearCsrfCookieOptions)
}

export function csrfTokensMatch(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}
