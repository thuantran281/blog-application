import { createPostViaApi, expect, test } from './fixtures'

test.describe('seo', () => {
  test('publishes sitemap, RSS, and robots entries', async ({ request, e2eRun }) => {
    const title = `${e2eRun.prefix} published seo post`
    const published = await createPostViaApi(request, {
      title,
      content: 'A published SEO post.',
      status: 'published',
    })
    const draft = await createPostViaApi(request, {
      title: `${e2eRun.prefix} draft seo post`,
      content: 'A draft SEO post.',
      status: 'draft',
    })

    const sitemap = await request.get('/sitemap.xml')
    expect(sitemap.ok()).toBeTruthy()
    const sitemapText = await sitemap.text()
    expect(sitemapText).toContain(`/posts/${published.slug}`)
    expect(sitemapText).not.toContain(`/posts/${draft.slug}`)

    const rss = await request.get('/rss.xml')
    expect(rss.ok()).toBeTruthy()
    const rssText = await rss.text()
    expect(rssText).toContain(title)
    expect(rssText).not.toContain(draft.title)

    const robots = await request.get('/robots.txt')
    expect(robots.ok()).toBeTruthy()
    expect(await robots.text()).toContain('/sitemap.xml')

    const publishedHtml = await request.get(`/posts/${published.slug}`)
    expect(publishedHtml.ok()).toBeTruthy()
    const publishedHtmlText = await publishedHtml.text()
    expect(publishedHtmlText).toContain(`<title>${title} — Inkwell</title>`)
    expect(publishedHtmlText).toContain('data-seo-managed="true"')

    const draftHtml = await request.get(`/posts/${draft.slug}`)
    expect(draftHtml.status()).toBe(200)
    expect(draftHtml.headers()['x-robots-tag']).toContain('noindex')
    expect(await draftHtml.text()).not.toContain(draft.title)

    const notFound = await request.get('/posts/does-not-exist')
    expect(notFound.status()).toBe(404)

    const home = await request.get('/')
    expect(home.ok()).toBeTruthy()
    const homeHtml = await home.text()
    expect(homeHtml).toContain('<title>Inkwell — Blog</title>')
    expect(homeHtml).toContain('rel="canonical"')

    const login = await request.get('/login')
    expect(login.headers()['x-robots-tag']).toContain('noindex')
  })

  test('injects post metadata on direct page load', async ({ page, request, e2eRun }) => {
    const title = `${e2eRun.prefix} seo metadata`
    const post = await createPostViaApi(request, {
      title,
      content: 'Meta description content.',
      status: 'published',
    })

    await page.goto(`/posts/${post.slug}`)

    await expect(page).toHaveTitle(`${title} — Inkwell`)
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      'Meta description content.',
    )
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      new RegExp(`/posts/${post.slug}$`),
    )
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article')
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      'content',
      `${title} — Inkwell`,
    )
  })
})
