import { randomUUID } from 'node:crypto'
import type { RequestHandler } from 'express'
import { logger } from '../lib/logger.js'

export const requestLogger: RequestHandler = (req, res, next) => {
  const requestId = randomUUID()
  const startedAt = process.hrtime.bigint()

  res.locals.requestId = requestId
  res.setHeader('X-Request-Id', requestId)

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000

    logger.info('request completed', {
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
    })
  })

  next()
}
