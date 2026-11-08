import { Pool } from 'pg'
import { logger } from '../lib/logger.js'
import { env } from './env.js'

const pool = new Pool({
  user: env.DB_USER,
  host: env.DB_HOST,
  database: env.DB_NAME,
  password: env.DB_PASSWORD,
  port: env.DB_PORT,
  max: env.DB_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

pool.on('error', (error) => {
  logger.error('Unexpected PostgreSQL pool error', {
    error: logger.serializeError(error),
  })
})

export default pool
