import type { AuthUser } from './auth.js'

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
      authSource?: 'bearer' | 'cookie'
    }
  }
}

export {}
