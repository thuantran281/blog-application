import rateLimit from 'express-rate-limit'
import { env } from '../config/env.js'

const skip = () => env.NODE_ENV === 'test'
const message = { error: 'Too many requests, please try again later.' }

const commonOptions = {
  standardHeaders: 'draft-7' as const,
  legacyHeaders: false,
  skip,
  message,
}

export const apiLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  limit: 300,
})

export const authLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000,
  limit: 20,
})

export const commentLimiter = rateLimit({
  ...commonOptions,
  windowMs: 10 * 60 * 1000,
  limit: 30,
})
