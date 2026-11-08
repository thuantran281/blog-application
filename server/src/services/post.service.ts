import type { PoolClient } from 'pg'
import pool from '../config/db.js'
import type { AuthUser } from '../types/auth.js'
import { isForeignKeyViolation, isUniqueViolation } from '../utils/db.js'
import { slugify } from '../utils/slug.js'

const MAX_SLUG_ATTEMPTS = 20

export class SlugConflictError extends Error {
  constructor() {
    super('Could not generate a unique slug')
    this.name = 'SlugConflictError'
  }
}

export class PostAccessError extends Error {
  constructor(message = 'You do not have permission to modify this post') {
    super(message)
    this.name = 'PostAccessError'
  }
}

export class CategoryNotFoundError extends Error {
  constructor() {
    super('Category not found')
    this.name = 'CategoryNotFoundError'
  }
}

export class TagNotFoundError extends Error {
  constructor() {
    super('One or more tags were not found')
    this.name = 'TagNotFoundError'
  }
}

function canModifyPost(post: { author_id: string | null }, actor: AuthUser): boolean {
  if (actor.role === 'admin') {
    return true
  }

  return post.author_id !== null && post.author_id === actor.id
}

export interface PostSummary {
  id: string
  title: string
  slug: string
  excerpt: string | null
  status: 'draft' | 'published'
  created_at: Date
  updated_at: Date
  published_at: Date | null
  author_name: string | null
}

export interface Post extends PostSummary {
  content: string
  author_id: string | null
  category_id: string | null
}

export interface PostCategory {
  id: string
  name: string
  slug: string
}

export interface PostTag {
  id: string
  name: string
  slug: string
}

export interface PostWithRelations extends Post {
  category: PostCategory | null
  tags: PostTag[]
}

export interface PaginatedPosts {
  data: PostSummary[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface ListPostsParams {
  page: number
  limit: number
  category?: string | undefined
  tag?: string | undefined
}

interface ListMyPostsParams {
  page: number
  limit: number
  status?: 'draft' | 'published' | undefined
}

interface CreatePostParams {
  title: string
  content: string
  excerpt: string | null
  status: 'draft' | 'published'
  authorId: string
  authorDisplayName: string | null
  categoryId: string | null
  tagIds: string[]
}

interface UpdatePostParams {
  title?: string | undefined
  content?: string | undefined
  excerpt?: string | null | undefined
  status?: 'draft' | 'published' | undefined
  categoryId?: string | null | undefined
  tagIds?: string[] | undefined
  displayName?: string | null | undefined
}

const SUMMARY_COLUMNS = `
  p.id, p.title, p.slug, p.excerpt, p.status, p.created_at, p.updated_at, p.published_at,
  p.author_display_name AS author_name
`

const POST_COLUMNS = `
  id, title, slug, content, excerpt, author_id, category_id,
  status, created_at, updated_at, published_at,
  author_display_name AS author_name
`

export async function listPublishedPosts({
  page,
  limit,
  category,
  tag,
}: ListPostsParams): Promise<PaginatedPosts> {
  const offset = (page - 1) * limit
  const categorySlug = category ?? null
  const tagSlug = tag ?? null

  const [posts, count] = await Promise.all([
    pool.query<PostSummary>(
      `SELECT ${SUMMARY_COLUMNS}
       FROM posts p
       WHERE p.status = 'published'
         AND ($3::text IS NULL OR EXISTS (
           SELECT 1 FROM categories c WHERE c.id = p.category_id AND c.slug = $3
         ))
         AND ($4::text IS NULL OR EXISTS (
           SELECT 1
           FROM post_tags pt
           JOIN tags t ON t.id = pt.tag_id
           WHERE pt.post_id = p.id AND t.slug = $4
         ))
       ORDER BY p.published_at DESC NULLS LAST, p.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset, categorySlug, tagSlug],
    ),
    pool.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM posts p
       WHERE p.status = 'published'
         AND ($1::text IS NULL OR EXISTS (
           SELECT 1 FROM categories c WHERE c.id = p.category_id AND c.slug = $1
         ))
         AND ($2::text IS NULL OR EXISTS (
           SELECT 1
           FROM post_tags pt
           JOIN tags t ON t.id = pt.tag_id
           WHERE pt.post_id = p.id AND t.slug = $2
         ))`,
      [categorySlug, tagSlug],
    ),
  ])

  const total = count.rows[0]?.count ?? 0

  return {
    data: posts.rows,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

async function findPostCategory(categoryId: string | null): Promise<PostCategory | null> {
  if (!categoryId) {
    return null
  }

  const result = await pool.query<PostCategory>(
    'SELECT id, name, slug FROM categories WHERE id = $1 LIMIT 1',
    [categoryId],
  )

  return result.rows[0] ?? null
}

async function findPostTags(postId: string): Promise<PostTag[]> {
  const result = await pool.query<PostTag>(
    `SELECT t.id, t.name, t.slug
     FROM tags t
     JOIN post_tags pt ON pt.tag_id = t.id
     WHERE pt.post_id = $1
     ORDER BY t.name`,
    [postId],
  )

  return result.rows
}

async function attachRelations(post: Post): Promise<PostWithRelations> {
  const [category, tags] = await Promise.all([
    findPostCategory(post.category_id),
    findPostTags(post.id),
  ])

  return { ...post, category, tags }
}

async function setPostTags(client: PoolClient, postId: string, tagIds: string[]): Promise<void> {
  await client.query('DELETE FROM post_tags WHERE post_id = $1', [postId])

  const uniqueTagIds = [...new Set(tagIds)]

  if (uniqueTagIds.length === 0) {
    return
  }

  const result = await client.query(
    `INSERT INTO post_tags (post_id, tag_id)
     SELECT $1, id FROM tags WHERE id = ANY($2::uuid[])
     ON CONFLICT DO NOTHING`,
    [postId, uniqueTagIds],
  )

  if (result.rowCount !== uniqueTagIds.length) {
    throw new TagNotFoundError()
  }
}

export async function findPostBySlug(slug: string): Promise<PostWithRelations | null> {
  const result = await pool.query<Post>(
    `SELECT ${POST_COLUMNS}
     FROM posts
     WHERE slug = $1
     LIMIT 1`,
    [slug],
  )

  const post = result.rows[0]

  return post ? attachRelations(post) : null
}

export async function listMyPosts(
  authorId: string,
  { page, limit, status }: ListMyPostsParams,
): Promise<PaginatedPosts> {
  const offset = (page - 1) * limit
  const statusFilter = status ?? null

  const [posts, count] = await Promise.all([
    pool.query<PostSummary>(
      `SELECT ${SUMMARY_COLUMNS}
       FROM posts p
       WHERE p.author_id = $1
         AND ($4::text IS NULL OR p.status = $4)
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [authorId, limit, offset, statusFilter],
    ),
    pool.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM posts p
       WHERE p.author_id = $1
         AND ($2::text IS NULL OR p.status = $2)`,
      [authorId, statusFilter],
    ),
  ])

  const total = count.rows[0]?.count ?? 0

  return {
    data: posts.rows,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

export async function createPost({
  title,
  content,
  excerpt,
  status,
  authorId,
  authorDisplayName,
  categoryId,
  tagIds,
}: CreatePostParams): Promise<PostWithRelations> {
  const baseSlug = slugify(title) || 'post'
  const publishedAt = status === 'published' ? new Date() : null

  let created: Post | null = null

  for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
    const slug = attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      const result = await client.query<Post>(
        `INSERT INTO posts
           (title, slug, content, excerpt, author_id, author_display_name, category_id, status, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING ${POST_COLUMNS}`,
        [
          title,
          slug,
          content,
          excerpt,
          authorId,
          authorDisplayName,
          categoryId,
          status,
          publishedAt,
        ],
      )

      const post = result.rows[0]

      if (!post) {
        throw new Error('Insert did not return a post')
      }

      await setPostTags(client, post.id, tagIds)
      await client.query('COMMIT')

      created = post
      break
    } catch (err) {
      await client.query('ROLLBACK')

      if (isForeignKeyViolation(err)) {
        throw new CategoryNotFoundError()
      }

      if (isUniqueViolation(err)) {
        continue
      }

      throw err
    } finally {
      client.release()
    }
  }

  if (!created) {
    throw new SlugConflictError()
  }

  return attachRelations(created)
}

export async function deletePost(id: string, actor: AuthUser): Promise<boolean> {
  const existing = await pool.query<{ author_id: string | null }>(
    'SELECT author_id FROM posts WHERE id = $1',
    [id],
  )

  const current = existing.rows[0]

  if (!current) {
    return false
  }

  if (!canModifyPost(current, actor)) {
    throw new PostAccessError()
  }

  const result = await pool.query('DELETE FROM posts WHERE id = $1 RETURNING id', [id])

  return result.rowCount === 1
}

export async function updatePost(
  id: string,
  input: UpdatePostParams,
  actor: AuthUser,
): Promise<PostWithRelations | null> {
  const existing = await pool.query<Post>(`SELECT ${POST_COLUMNS} FROM posts WHERE id = $1`, [id])

  const current = existing.rows[0]

  if (!current) {
    return null
  }

  if (!canModifyPost(current, actor)) {
    throw new PostAccessError()
  }

  const title = input.title ?? current.title
  const content = input.content ?? current.content
  const excerpt = input.excerpt === undefined ? current.excerpt : input.excerpt
  const status = input.status ?? current.status
  const categoryId = input.categoryId === undefined ? current.category_id : input.categoryId
  const authorDisplayName =
    input.displayName === undefined ? current.author_name : input.displayName
  const publishedAt = status === 'published' ? (current.published_at ?? new Date()) : null

  const titleChanged = input.title !== undefined && input.title !== current.title
  const baseSlug = titleChanged ? slugify(title) || 'post' : current.slug

  let updated: Post | null = null

  for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
    const slug = attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      const result = await client.query<Post>(
        `UPDATE posts
         SET title = $1, slug = $2, content = $3, excerpt = $4,
             category_id = $5, status = $6, published_at = $7,
             author_display_name = $8
         WHERE id = $9
         RETURNING ${POST_COLUMNS}`,
        [title, slug, content, excerpt, categoryId, status, publishedAt, authorDisplayName, id],
      )

      const post = result.rows[0]

      if (!post) {
        await client.query('ROLLBACK')
        return null
      }

      if (input.tagIds !== undefined) {
        await setPostTags(client, post.id, input.tagIds)
      }

      await client.query('COMMIT')

      updated = post
      break
    } catch (err) {
      await client.query('ROLLBACK')

      if (isForeignKeyViolation(err)) {
        throw new CategoryNotFoundError()
      }

      if (isUniqueViolation(err)) {
        continue
      }

      throw err
    } finally {
      client.release()
    }
  }

  if (!updated) {
    throw new SlugConflictError()
  }

  return attachRelations(updated)
}
