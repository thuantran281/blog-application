import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app, createPost, registerUser, resetDb } from './helpers.js'

describe('seo endpoints', () => {
  beforeEach(resetDb)

  it('publishes only published posts in the sitemap and feed', async () => {
    const { token } = await registerUser()
    const published = await createPost(token, {
      title: 'Published & Ready',
      content: 'A published post',
      excerpt: 'A & B <C>',
      status: 'published',
    })
    const draft = await createPost(token, {
      title: 'Secret Draft',
      content: 'Not ready yet',
      status: 'draft',
    })

    const sitemap = await request(app).get('/sitemap.xml')

    expect(sitemap.status).toBe(200)
    expect(sitemap.headers['content-type']).toContain('application/xml')
    expect(sitemap.text).toContain(`/posts/${published.slug}`)
    expect(sitemap.text).not.toContain(draft.slug)
    expect(sitemap.headers['cache-control']).toContain('max-age=300')

    const rss = await request(app).get('/rss.xml')

    expect(rss.status).toBe(200)
    expect(rss.headers['content-type']).toContain('application/rss+xml')
    expect(rss.text).toContain('Published &amp; Ready')
    expect(rss.text).toContain('A &amp; B &lt;C&gt;')
    expect(rss.text).not.toContain('Secret Draft')
    expect(rss.text).toContain(`/posts/${published.slug}`)
  })

  it('serves robots.txt with a sitemap reference', async () => {
    const response = await request(app).get('/robots.txt')

    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toContain('text/plain')
    expect(response.text).toContain('Disallow: /api/')
    expect(response.text).toContain('/sitemap.xml')
  })
})
