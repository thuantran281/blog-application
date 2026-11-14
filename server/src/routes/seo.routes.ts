import { Router } from 'express'
import { renderRobots, renderRss, renderSitemap, siteUrlFromRequest } from '../lib/seo.js'
import { listPublishedPostsForFeed, listPublishedPostsForSitemap } from '../services/seo.service.js'

const FEED_LIMIT = 50
const CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=600'

const router = Router()

router.get('/sitemap.xml', async (req, res) => {
  const siteUrl = siteUrlFromRequest(req)
  const entries = await listPublishedPostsForSitemap()

  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', CACHE_CONTROL)
  res.send(renderSitemap(siteUrl, entries))
})

router.get('/rss.xml', async (req, res) => {
  const siteUrl = siteUrlFromRequest(req)
  const posts = await listPublishedPostsForFeed(FEED_LIMIT)

  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8')
  res.setHeader('Cache-Control', CACHE_CONTROL)
  res.send(renderRss(siteUrl, posts))
})

router.get('/robots.txt', (req, res) => {
  const siteUrl = siteUrlFromRequest(req)

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=86400')
  res.send(renderRobots(siteUrl))
})

export default router
