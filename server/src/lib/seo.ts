import type { Request } from 'express'
import type { SeoPost, SitemapEntry } from '../services/seo.service.js'

export const SITE_NAME = 'Inkwell'
export const SITE_DESCRIPTION =
  'Inkwell is a community blog for sharing stories, ideas, and drafts.'
export const DEFAULT_TITLE = `${SITE_NAME} — Blog`

export interface PageMeta {
  title: string
  description: string
  canonicalUrl: string
  type: 'website' | 'article'
  publishedAt: string | null
  modifiedAt: string | null
  author: string | null
  noIndex: boolean
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export const escapeHtml = escapeXml

export function plainText(markdown: string, maxLength: number): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^[ \t]*[-*+] /gm, ' ')
    .replace(/[#>*_~|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, maxLength - 1).trimEnd()}…`
}

export function postDescription(post: SeoPost): string {
  return post.excerpt?.trim() || plainText(post.content, 280) || SITE_DESCRIPTION
}

export function postPath(slug: string): string {
  return `/posts/${encodeURIComponent(slug)}`
}

export function siteUrlFromRequest(req: Request): string {
  const host = req.get('host')
  return host ? `${req.protocol}://${host}` : 'http://localhost'
}

export function buildDefaultMeta(siteUrl: string, noIndex = false): PageMeta {
  return {
    title: DEFAULT_TITLE,
    description: SITE_DESCRIPTION,
    canonicalUrl: `${siteUrl}/`,
    type: 'website',
    publishedAt: null,
    modifiedAt: null,
    author: null,
    noIndex,
  }
}

export function buildPostMeta(post: SeoPost, siteUrl: string): PageMeta {
  if (post.status !== 'published') {
    return buildDefaultMeta(siteUrl, true)
  }

  return {
    title: `${post.title} — ${SITE_NAME}`,
    description: postDescription(post),
    canonicalUrl: `${siteUrl}${postPath(post.slug)}`,
    type: 'article',
    publishedAt: post.published_at?.toISOString() ?? null,
    modifiedAt: post.updated_at.toISOString(),
    author: post.author_name,
    noIndex: false,
  }
}

export function renderIndexHtml(template: string, meta: PageMeta): string {
  const tags = [
    `<link rel="canonical" href="${escapeHtml(meta.canonicalUrl)}" data-seo-managed="true" />`,
    `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" data-seo-managed="true" />`,
    `<meta property="og:type" content="${meta.type}" data-seo-managed="true" />`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}" data-seo-managed="true" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" data-seo-managed="true" />`,
    `<meta property="og:url" content="${escapeHtml(meta.canonicalUrl)}" data-seo-managed="true" />`,
    `<meta name="twitter:card" content="summary" data-seo-managed="true" />`,
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}" data-seo-managed="true" />`,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" data-seo-managed="true" />`,
  ]

  if (meta.noIndex) {
    tags.push('<meta name="robots" content="noindex, nofollow" data-seo-managed="true" />')
  }

  if (meta.author) {
    tags.push(
      `<meta name="author" content="${escapeHtml(meta.author)}" data-seo-managed="true" />`,
      `<meta property="article:author" content="${escapeHtml(meta.author)}" data-seo-managed="true" />`,
    )
  }

  if (meta.publishedAt) {
    tags.push(
      `<meta property="article:published_time" content="${escapeHtml(meta.publishedAt)}" data-seo-managed="true" />`,
    )
  }

  if (meta.modifiedAt) {
    tags.push(
      `<meta property="article:modified_time" content="${escapeHtml(meta.modifiedAt)}" data-seo-managed="true" />`,
    )
  }

  let html = template
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    )

  if (html.includes('<!--seo-->')) {
    html = html.replace('<!--seo-->', tags.join('\n    '))
  } else {
    html = html.replace('</head>', `    ${tags.join('\n    ')}\n  </head>`)
  }

  return html
}

export function renderSitemap(siteUrl: string, entries: SitemapEntry[]): string {
  const urls = [
    `  <url>\n    <loc>${escapeXml(`${siteUrl}/`)}</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`,
    ...entries.map(
      (entry) =>
        `  <url>\n    <loc>${escapeXml(`${siteUrl}${postPath(entry.slug)}`)}</loc>\n    <lastmod>${entry.updated_at.toISOString()}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`,
    ),
  ]

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}

export function renderRss(siteUrl: string, posts: SeoPost[]): string {
  const latest = posts[0]?.published_at ?? new Date()
  const items = posts.map((post) => {
    const url = `${siteUrl}${postPath(post.slug)}`
    const publishedAt = post.published_at ?? post.updated_at

    return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${publishedAt.toUTCString()}</pubDate>
      <description>${escapeXml(postDescription(post))}</description>${
        post.author_name ? `\n      <dc:creator>${escapeXml(post.author_name)}</dc:creator>` : ''
      }
    </item>`
  })

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${escapeXml(`${siteUrl}/`)}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>en</language>
    <lastBuildDate>${latest.toUTCString()}</lastBuildDate>
    <ttl>60</ttl>
    <atom:link href="${escapeXml(`${siteUrl}/rss.xml`)}" rel="self" type="application/rss+xml" />
${items.join('\n')}
  </channel>
</rss>
`
}

export function renderRobots(siteUrl: string): string {
  return `User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /my-posts
Disallow: /write
Disallow: /login
Disallow: /register
Disallow: /posts/*/edit

Sitemap: ${siteUrl}/sitemap.xml
`
}
