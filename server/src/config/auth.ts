import type { SignOptions } from 'jsonwebtoken'
import { env } from './env.js'

export const JWT_SECRET = env.JWT_SECRET
export const JWT_EXPIRES_IN = env.JWT_EXPIRES_IN as NonNullable<SignOptions['expiresIn']>
