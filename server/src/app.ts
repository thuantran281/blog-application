import { existsSync } from 'node:fs'
import path from 'node:path'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import pool from './config/db.js'
import { corsOrigins, env } from './config/env.js'
import { logger } from './lib/logger.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'
import { apiLimiter } from './middleware/rateLimit.js'
import { requestLogger } from './middleware/requestLogger.js'
import authRoutes from './routes/auth.routes.js'
import categoryRoutes from './routes/category.routes.js'
import commentRoutes from './routes/comment.routes.js'
import postRoutes from './routes/post.routes.js'
import tagRoutes from './routes/tag.routes.js'

function isAllowedOrigin(origin: string | undefined) {
  if (!origin) {
    return true
  }

  if (env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return true
  }

  return corsOrigins.includes(origin)
}

const app = express()

const clientDistPath = env.CLIENT_DIST_PATH ? path.resolve(env.CLIENT_DIST_PATH) : undefined
const clientBuildPath =
  clientDistPath && existsSync(path.join(clientDistPath, 'index.html')) ? clientDistPath : undefined

if (env.TRUST_PROXY) {
  app.set('trust proxy', 1)
}

app.use(requestLogger)
app.use(helmet())
app.use(
  cors({
    origin(origin, callback) {
      callback(null, isAllowedOrigin(origin))
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600,
  }),
)
app.use(express.json({ limit: env.JSON_BODY_LIMIT }))
app.use('/api', apiLimiter)

app.get('/health/live', (req, res) => {
  res.json({ status: 'ok' })
})

app.get('/health/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ status: 'ok' })
  } catch (err) {
    logger.warn('Readiness check failed', {
      requestId: res.locals.requestId,
      error: logger.serializeError(err),
    })
    res.status(503).json({ status: 'unavailable' })
  }
})

app.get('/', async (req, res, next) => {
  if (clientBuildPath) {
    next()
    return
  }

  try {
    const result = await pool.query<{ now: Date }>('SELECT NOW()')
    res.json({ message: 'Blog API is running!', db_time: result.rows[0]?.now })
  } catch (err) {
    logger.error('Database health check failed', {
      requestId: res.locals.requestId,
      error: logger.serializeError(err),
    })
    res.status(500).json({ error: 'Database connection failed' })
  }
})

app.use('/api/auth', authRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/tags', tagRoutes)
app.use('/api/posts', postRoutes)
app.use('/api/comments', commentRoutes)

if (clientBuildPath) {
  app.use(express.static(clientBuildPath, { index: false }))
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/health')) {
      next()
      return
    }

    res.sendFile(path.join(clientBuildPath, 'index.html'), (error) => {
      if (error) {
        next(error)
      }
    })
  })
}

app.use(notFoundHandler)
app.use(errorHandler)

export default app
