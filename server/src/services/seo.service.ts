import pool from '../config/db.js'

export interface SeoPost {
  title: string
  slug: string
  excerpt: string | null
  content: string
  status: 'draft' | 'published'
  published_at: Date | null
  updated_at: Date
  author_name: string | null
}

export interface SitemapEntry {
  slug: string
  published_at: Date | null
  updated_at: Date
}

const SEO_POST_COLUMNS = `
  title, slug, excerpt, content, status, published_at, updated_at,
  author_display_name AS author_name
`

export async function listPublishedPostsForFeed(limit: number): Promise<SeoPost[]> {
  const result = await pool.query<SeoPost>(
    `SELECT ${SEO_POST_COLUMNS}
     FROM posts
     WHERE status = 'published'
     ORDER BY published_at DESC NULLS LAST, created_at DESC
     LIMIT $1`,
    [limit],
  )

  return result.rows
}

export async function listPublishedPostsForSitemap(): Promise<SitemapEntry[]> {
  const result = await pool.query<SitemapEntry>(
    `SELECT slug, published_at, updated_at
     FROM posts
     WHERE status = 'published'
     ORDER BY published_at DESC NULLS LAST, created_at DESC`,
  )

  return result.rows
}

export async function findPostForSeo(slug: string): Promise<SeoPost | null> {
  const result = await pool.query<SeoPost>(
    `SELECT ${SEO_POST_COLUMNS}
     FROM posts
     WHERE slug = $1
     LIMIT 1`,
    [slug],
  )

  return result.rows[0] ?? null
}
