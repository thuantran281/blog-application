import pool from '../config/db.js'
import type { UserRole } from '../types/auth.js'
import { hashPassword, type User } from './auth.service.js'

const PUBLIC_COLUMNS = 'id, username, email, role, created_at, updated_at'

export interface PaginatedUsers {
  data: User[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export class SelfModificationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SelfModificationError'
  }
}

interface ListUsersParams {
  page: number
  limit: number
  q?: string | undefined
}

export async function listUsers({ page, limit, q }: ListUsersParams): Promise<PaginatedUsers> {
  const offset = (page - 1) * limit
  // Escape LIKE wildcards so the query matches literal text.
  const pattern = q ? `%${q.replace(/[\\%_]/g, '\\$&')}%` : null

  const [users, count] = await Promise.all([
    pool.query<User>(
      `SELECT ${PUBLIC_COLUMNS}
       FROM users
       WHERE ($1::text IS NULL
         OR username ILIKE $1 ESCAPE '\\'
         OR email ILIKE $1 ESCAPE '\\')
       ORDER BY username ASC
       LIMIT $2 OFFSET $3`,
      [pattern, limit, offset],
    ),
    pool.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM users
       WHERE ($1::text IS NULL
         OR username ILIKE $1 ESCAPE '\\'
         OR email ILIKE $1 ESCAPE '\\')`,
      [pattern],
    ),
  ])

  const total = count.rows[0]?.count ?? 0

  return {
    data: users.rows,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

export async function updateUserRole(
  id: string,
  role: UserRole,
  actorId: string,
): Promise<User | null> {
  if (id === actorId) {
    throw new SelfModificationError('You cannot change your own role')
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const result = await client.query<User>(
      `UPDATE users SET role = $2 WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
      [id, role],
    )
    const user = result.rows[0]

    if (!user) {
      await client.query('ROLLBACK')
      return null
    }

    // Like the promote-admin script, the new role applies on the next login.
    await client.query('DELETE FROM sessions WHERE user_id = $1', [id])
    await client.query('COMMIT')

    return user
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

export async function resetUserPassword(
  id: string,
  password: string,
  actorId: string,
): Promise<User | null> {
  if (id === actorId) {
    throw new SelfModificationError('You cannot reset your own password here')
  }

  const passwordHash = await hashPassword(password)
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const result = await client.query<User>(
      `UPDATE users SET password_hash = $2 WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
      [id, passwordHash],
    )
    const user = result.rows[0]

    if (!user) {
      await client.query('ROLLBACK')
      return null
    }

    await client.query('DELETE FROM sessions WHERE user_id = $1', [id])
    await client.query('COMMIT')

    return user
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}
