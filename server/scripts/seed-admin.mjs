import 'dotenv/config'
import bcrypt from 'bcryptjs'
import pg from 'pg'

const username = process.env.ADMIN_USERNAME?.trim()
const email = process.env.ADMIN_EMAIL?.trim()
const password = process.env.ADMIN_PASSWORD

if (!username || !email || !password) {
  console.error('Set ADMIN_USERNAME, ADMIN_EMAIL, and ADMIN_PASSWORD before seeding an admin.')
  process.exit(1)
}

const pool = new pg.Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT) || 5432,
})

const client = await pool.connect()

try {
  const passwordHash = await bcrypt.hash(password, 10)

  await client.query('BEGIN')

  const existing = await client.query('SELECT id FROM users WHERE lower(email) = lower($1)', [
    email,
  ])

  const current = existing.rows[0]

  if (current) {
    await client.query('UPDATE users SET password_hash = $2, role = $3 WHERE id = $1', [
      current.id,
      passwordHash,
      'admin',
    ])
    console.log(`Reset password and promoted existing user <${email}> to admin.`)
  } else {
    await client.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin')`,
      [username, email, passwordHash],
    )
    console.log(`Created admin ${username} <${email}>.`)
  }

  await client.query('COMMIT')
} catch (err) {
  await client.query('ROLLBACK').catch(() => {})
  console.error('Failed to seed admin:', err.message)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
