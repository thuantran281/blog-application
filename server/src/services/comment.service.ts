import pool from '../config/db.js'

const COMMENT_COLUMNS = `
  c.id, c.post_id, c.user_id, c.guest_name, c.content, c.created_at,
  COALESCE(u.username, c.guest_name) AS author_name
`

export interface Comment {
  id: string
  post_id: string
  user_id: string | null
  guest_name: string | null
  content: string
  created_at: Date
  author_name: string
}

export interface PaginatedComments {
  data: Comment[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface ListCommentsParams {
  page: number
  limit: number
}

interface CreateCommentParams {
  postId: string
  userId: string | null
  guestName: string | null
  content: string
}

export async function findPublishedPostIdBySlug(slug: string): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    `SELECT id FROM posts WHERE slug = $1 AND status = 'published' LIMIT 1`,
    [slug],
  )

  return result.rows[0]?.id ?? null
}

export async function findCommentById(id: string): Promise<Comment | null> {
  const result = await pool.query<Comment>(
    `SELECT ${COMMENT_COLUMNS}
     FROM comments c
     LEFT JOIN users u ON u.id = c.user_id
     WHERE c.id = $1
     LIMIT 1`,
    [id],
  )

  return result.rows[0] ?? null
}

export async function listCommentsByPostId(
  postId: string,
  { page, limit }: ListCommentsParams,
): Promise<PaginatedComments> {
  const offset = (page - 1) * limit

  const [comments, count] = await Promise.all([
    pool.query<Comment>(
      `SELECT ${COMMENT_COLUMNS}
       FROM comments c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.post_id = $1
       ORDER BY c.created_at ASC
       LIMIT $2 OFFSET $3`,
      [postId, limit, offset],
    ),
    pool.query<{ count: number }>(
      'SELECT COUNT(*)::int AS count FROM comments WHERE post_id = $1',
      [postId],
    ),
  ])

  const total = count.rows[0]?.count ?? 0

  return {
    data: comments.rows,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

export async function createComment({
  postId,
  userId,
  guestName,
  content,
}: CreateCommentParams): Promise<Comment> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO comments (post_id, user_id, guest_name, content)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [postId, userId, guestName, content],
  )

  const id = result.rows[0]?.id

  if (!id) {
    throw new Error('Insert did not return a comment')
  }

  const comment = await findCommentById(id)

  if (!comment) {
    throw new Error('Could not load the created comment')
  }

  return comment
}

export async function deleteComment(id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM comments WHERE id = $1 RETURNING id', [id])

  return result.rowCount === 1
}
