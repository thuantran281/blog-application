import 'dotenv/config'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations')

const pool = new pg.Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT) || 5432,
})

const client = await pool.connect()

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort()

  for (const file of files) {
    const applied = await client.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [
      file,
    ])

    if (applied.rowCount > 0) {
      console.log(`skip    ${file}`)
      continue
    }

    const sql = await readFile(join(migrationsDir, file), 'utf8')

    await client.query('BEGIN')
    try {
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file])
      await client.query('COMMIT')
      console.log(`applied ${file}`)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    }
  }
} catch (err) {
  console.error('Migration failed:', err.message)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
