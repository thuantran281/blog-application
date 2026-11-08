import type { Server } from 'node:http'
import app from './app.js'
import pool from './config/db.js'
import { env } from './config/env.js'
import { logger } from './lib/logger.js'

let server: Server | undefined
let shuttingDown = false

function serializeStartupError(error: unknown) {
  return logger.serializeError(error)
}

function shutdown(signal: string) {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  logger.info('Shutting down server', { signal })

  const forceTimer = setTimeout(() => {
    logger.error('Forced shutdown after timeout')
    process.exit(1)
  }, 10_000)
  forceTimer.unref()

  if (!server) {
    void pool.end().finally(() => process.exit(0))
    return
  }

  server.close((error) => {
    if (error) {
      logger.error('HTTP server failed to close cleanly', {
        error: serializeStartupError(error),
      })
      process.exitCode = 1
    }

    pool
      .end()
      .catch((poolError: unknown) => {
        logger.error('Database pool failed to close cleanly', {
          error: serializeStartupError(poolError),
        })
        process.exitCode = 1
      })
      .finally(() => {
        clearTimeout(forceTimer)
        process.exit(process.exitCode ?? 0)
      })
  })
}

async function start() {
  await pool.query('SELECT 1')

  server = app.listen(env.PORT, () => {
    logger.info('Server started', {
      port: env.PORT,
      environment: env.NODE_ENV,
    })
  })

  server.requestTimeout = 30_000
  server.headersTimeout = 35_000

  process.once('SIGINT', () => shutdown('SIGINT'))
  process.once('SIGTERM', () => shutdown('SIGTERM'))
  process.once('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error: serializeStartupError(error) })
    shutdown('uncaughtException')
  })
  process.once('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { error: serializeStartupError(reason) })
    shutdown('unhandledRejection')
  })
}

start().catch(async (error: unknown) => {
  logger.error('Failed to start server', { error: serializeStartupError(error) })

  try {
    await pool.end()
  } catch (poolError) {
    logger.error('Database pool failed to close after startup error', {
      error: serializeStartupError(poolError),
    })
  }

  process.exit(1)
})
