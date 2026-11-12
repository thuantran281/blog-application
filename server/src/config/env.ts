import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config({ quiet: true })

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DB_USER: z.string().min(1),
  DB_HOST: z.string().min(1).default('localhost'),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  DB_PASSWORD: z.string().min(8, 'DB_PASSWORD must be at least 8 characters'),
  DB_NAME: z.string().min(1),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().min(1).default('7d'),
  CORS_ORIGINS: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('info'),
  JSON_BODY_LIMIT: z.string().min(1).max(32).default('100kb'),
  CLIENT_DIST_PATH: z.string().min(1).optional(),
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
    .join('\n')

  throw new Error(`Invalid environment configuration:\n${details}`)
}

function parseCorsOrigins(raw: string | undefined): string[] {
  const origins =
    raw
      ?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? []
  const parsedOrigins: string[] = []

  for (const origin of origins) {
    let url: URL

    try {
      url = new URL(origin)
    } catch {
      throw new Error(
        'Invalid environment configuration: CORS_ORIGINS must contain valid absolute URLs',
      )
    }

    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== '/' && url.pathname !== '') ||
      url.origin !== origin.replace(/\/$/, '')
    ) {
      throw new Error(
        'Invalid environment configuration: CORS_ORIGINS entries must be exact origins without paths, credentials, queries, or fragments',
      )
    }

    parsedOrigins.push(url.origin)
  }

  return parsedOrigins
}

const configuredCorsOrigins = parseCorsOrigins(parsed.data.CORS_ORIGINS)

if (parsed.data.NODE_ENV === 'production') {
  if (configuredCorsOrigins.length === 0) {
    throw new Error('Invalid environment configuration: CORS_ORIGINS is required in production')
  }

  if (
    /(change[-_ ]?me|replace[-_ ]?with|your[-_ ]|example|placeholder)/i.test(parsed.data.JWT_SECRET)
  ) {
    throw new Error('Invalid environment configuration: JWT_SECRET must not use a placeholder')
  }

  for (const origin of configuredCorsOrigins) {
    const url = new URL(origin)
    const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(url.hostname)

    if (url.protocol !== 'https:' && !isLoopback) {
      throw new Error(
        'Invalid environment configuration: CORS_ORIGINS must use https outside localhost',
      )
    }
  }
}

const developmentCorsOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
]

export const env = parsed.data

export const corsOrigins =
  configuredCorsOrigins.length > 0 ? configuredCorsOrigins : developmentCorsOrigins
