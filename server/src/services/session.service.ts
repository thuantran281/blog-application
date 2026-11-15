import pool from '../config/db.js'

export async function createSession(
  sessionId: string,
  userId: string,
  expiresAt: Date,
): Promise<void> {
  await pool.query('DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP')
  await pool.query(
    `INSERT INTO sessions (id, user_id, expires_at)
     VALUES ($1, $2, $3)`,
    [sessionId, userId, expiresAt],
  )
}

export async function isSessionActive(sessionId: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1
     FROM sessions
     WHERE id = $1
       AND user_id = $2
       AND expires_at > CURRENT_TIMESTAMP
     LIMIT 1`,
    [sessionId, userId],
  )

  return (result.rowCount ?? 0) > 0
}

export async function revokeSession(sessionId: string, userId: string): Promise<void> {
  await pool.query('DELETE FROM sessions WHERE id = $1 AND user_id = $2', [sessionId, userId])
}
