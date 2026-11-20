import pool from '../config/db.js'

export interface ReportedComment {
  comment_id: string
  content: string
  author_name: string | null
  created_at: Date
  post_id: string
  post_title: string
  post_slug: string
  report_count: number
  last_reported_at: Date
}

export interface PaginatedReports {
  data: ReportedComment[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface CreateReportResult {
  created: boolean
  reportCount: number
}

export async function createCommentReport(
  commentId: string,
  reporterKey: string,
): Promise<CreateReportResult> {
  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO comment_reports (comment_id, reporter_key)
     VALUES ($1, $2)
     ON CONFLICT ON CONSTRAINT comment_reports_comment_reporter_key DO NOTHING
     RETURNING id`,
    [commentId, reporterKey],
  )

  const count = await pool.query<{ count: number }>(
    'SELECT COUNT(*)::int AS count FROM comment_reports WHERE comment_id = $1',
    [commentId],
  )

  return {
    created: inserted.rowCount === 1,
    reportCount: count.rows[0]?.count ?? 0,
  }
}

export async function listReportedComments({
  page,
  limit,
}: {
  page: number
  limit: number
}): Promise<PaginatedReports> {
  const offset = (page - 1) * limit

  const [reports, count] = await Promise.all([
    pool.query<ReportedComment>(
      `SELECT c.id AS comment_id, c.content, c.created_at,
              COALESCE(u.username, c.guest_name) AS author_name,
              p.id AS post_id, p.title AS post_title, p.slug AS post_slug,
              COUNT(r.id)::int AS report_count,
              MAX(r.created_at) AS last_reported_at
       FROM comment_reports r
       JOIN comments c ON c.id = r.comment_id
       JOIN posts p ON p.id = c.post_id
       LEFT JOIN users u ON u.id = c.user_id
       GROUP BY c.id, c.content, c.created_at, c.guest_name, u.username,
                p.id, p.title, p.slug
       ORDER BY MAX(r.created_at) DESC, c.id
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    ),
    pool.query<{ count: number }>(
      'SELECT COUNT(DISTINCT comment_id)::int AS count FROM comment_reports',
    ),
  ])

  const total = count.rows[0]?.count ?? 0

  return {
    data: reports.rows,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}
