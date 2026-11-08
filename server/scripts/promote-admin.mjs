import 'dotenv/config'
import pg from 'pg'

const identifier = process.argv[2]?.trim()

if (!identifier) {
  console.error('Usage: npm run promote-admin -- <email-or-username>')
  process.exit(1)
}

const pool = new pg.Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT) || 5432,
})

try {
  let result = await pool.query(
    `UPDATE users
     SET role = 'admin'
     WHERE lower(email) = lower($1)
     RETURNING username, email, role`,
    [identifier],
  )

  if (result.rowCount === 0) {
    result = await pool.query(
      `UPDATE users
       SET role = 'admin'
       WHERE username = $1
       RETURNING username, email, role`,
      [identifier],
    )
  }

  const user = result.rows[0]

  if (!user) {
    console.error(`No user found for "${identifier}"`)
    process.exitCode = 1
  } else {
    console.log(`Promoted ${user.username} <${user.email}> to ${user.role}.`)
    console.log('Log in again to receive a token with the updated role.')
  }
} catch (err) {
  console.error('Failed to promote user:', err.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
