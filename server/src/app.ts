import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import pool from './config/db.js'
import { corsOrigins, env } from './config/env.js'
import { logger } from './lib/logger.js'
import { buildDefaultMeta, buildPostMeta, renderIndexHtml, siteUrlFromRequest } from './lib/seo.js'
import { authenticate } from './middleware/auth.js'
import { csrfProtection } from './middleware/csrf.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'
import { apiLimiter } from './middleware/rateLimit.js'
import { requestLogger } from './middleware/requestLogger.js'
import authRoutes from './routes/auth.routes.js'
import categoryRoutes from './routes/category.routes.js'
import commentRoutes from './routes/comment.routes.js'
import postRoutes from './routes/post.routes.js'
import seoRoutes from './routes/seo.routes.js'
import tagRoutes from './routes/tag.routes.js'
import { findPostForSeo } from './services/seo.service.js'

function isAllowedOrigin(origin: string | undefined) {
  if (!origin) {
    return true
  }

  if (env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return true
  }

  return corsOrigins.includes(origin)
}

function isPrivateSpaPath(pathname: string): boolean {
  if (['/login', '/register', '/write', '/my-posts'].includes(pathname)) {
    return true
  }

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return true
  }

  return /^\/posts\/[^/]+\/edit$/.test(pathname)
}

function isKnownSpaPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/write' ||
    pathname === '/my-posts' ||
    pathname === '/admin/taxonomy' ||
    /^\/posts\/[^/]+$/.test(pathname) ||
    /^\/posts\/[^/]+\/edit$/.test(pathname)
  )
}

const app = express()

const clientDistPath = env.CLIENT_DIST_PATH ? path.resolve(env.CLIENT_DIST_PATH) : undefined
const clientBuildPath =
  clientDistPath && existsSync(path.join(clientDistPath, 'index.html')) ? clientDistPath : undefined
let clientIndexHtml: string | undefined

if (clientBuildPath) {
  try {
    clientIndexHtml = readFileSync(path.join(clientBuildPath, 'index.html'), 'utf8')
  } catch (err) {
    logger.warn('Could not read client index.html for SEO injection', {
      error: logger.serializeError(err),
    })
  }
}

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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    exposedHeaders: ['X-Request-Id'],
    credentials: true,
    maxAge: 600,
  }),
)
app.use(express.json({ limit: env.JSON_BODY_LIMIT }))
app.use('/api', apiLimiter)
app.use('/api', authenticate)
app.use('/api', csrfProtection)

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

app.use(seoRoutes)

app.use('/api/auth', authRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/tags', tagRoutes)
app.use('/api/posts', postRoutes)
app.use('/api/comments', commentRoutes)

if (clientBuildPath) {
  app.use(
    '/assets',
    express.static(path.join(clientBuildPath, 'assets'), {
      immutable: true,
      maxAge: '1y',
    }),
  )
  app.use(express.static(clientBuildPath, { index: false, maxAge: 0 }))
  app.use(async (req, res, next) => {
    if (
      req.method !== 'GET' ||
      req.path.startsWith('/api') ||
      req.path.startsWith('/health') ||
      req.path.startsWith('/assets')
    ) {
      next()
      return
    }

    const siteUrl = siteUrlFromRequest(req)
    let meta = buildDefaultMeta(siteUrl)
    let status = 200
    let noIndex = false

    const postMatch = /^\/posts\/([^/]+)$/.exec(req.path)

    if (postMatch?.[1]) {
      try {
        const slug = decodeURIComponent(postMatch[1])
        const post = await findPostForSeo(slug)

        if (post) {
          meta = buildPostMeta(post, siteUrl)
          noIndex = post.status !== 'published'
        } else {
          meta = buildDefaultMeta(siteUrl, true)
          noIndex = true
          status = 404
        }
      } catch (err) {
        logger.warn('Could not build post SEO metadata', {
          requestId: res.locals.requestId,
          path: req.path,
          error: logger.serializeError(err),
        })
        meta = buildDefaultMeta(siteUrl, true)
        noIndex = true
      }
    } else if (!isKnownSpaPath(req.path)) {
      meta = buildDefaultMeta(siteUrl, true)
      noIndex = true
      status = 404
    } else if (isPrivateSpaPath(req.path)) {
      meta = buildDefaultMeta(siteUrl, true)
      noIndex = true
    }

    if (noIndex) {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow')
    }

    res.setHeader('Cache-Control', 'no-cache')
    res.status(status)

    if (clientIndexHtml) {
      res.send(renderIndexHtml(clientIndexHtml, meta))
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
