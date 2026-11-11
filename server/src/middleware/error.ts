import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { logger } from '../lib/logger.js'

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

function getClientErrorStatus(err: unknown): number | null {
  if (typeof err !== 'object' || err === null) {
    return null
  }

  const status =
    'status' in err && typeof err.status === 'number'
      ? err.status
      : 'statusCode' in err && typeof err.statusCode === 'number'
        ? err.statusCode
        : null

  if (status !== null && status >= 400 && status < 500) {
    return status
  }

  return null
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: 'Not found' })
}

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    next(err)
    return
  }

  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validation failed', details: err.issues })
    return
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: err.message,
      ...(err.details === undefined ? {} : { details: err.details }),
    })
    return
  }

  const clientErrorStatus = getClientErrorStatus(err)

  if (clientErrorStatus !== null) {
    if (clientErrorStatus === 413) {
      res.status(413).json({ error: 'Payload too large' })
      return
    }

    const type =
      typeof err === 'object' && err !== null && 'type' in err ? String(err.type) : undefined

    if (type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Invalid JSON' })
      return
    }

    res.status(clientErrorStatus).json({ error: 'Bad request' })
    return
  }

  logger.error('Unhandled request error', {
    requestId: res.locals.requestId,
    method: req.method,
    path: req.originalUrl,
    error: logger.serializeError(err),
  })

  res.status(500).json({ error: 'Internal server error' })
}
