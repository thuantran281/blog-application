import type { NextFunction, Request, Response } from 'express'
import { CSRF_COOKIE, CSRF_HEADER, csrfTokensMatch, readCookie } from '../lib/cookies.js'
import { HttpError } from './error.js'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method) || req.authSource === 'bearer' || !req.user) {
    next()
    return
  }

  const cookieToken = readCookie(req, CSRF_COOKIE)
  const headerToken = req.get(CSRF_HEADER)

  if (!cookieToken || !headerToken || !csrfTokensMatch(cookieToken, headerToken)) {
    throw new HttpError(403, 'Invalid CSRF token')
  }

  next()
}
