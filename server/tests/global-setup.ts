import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import 'dotenv/config'
import pg from 'pg'

const TEST_DB_NAME = process.env.TEST_DB_NAME ?? 'blog_db_test'

function assertSafeName(name: string) {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error(`Invalid test database name: ${name}`)
  }
}

export default async function setup() {
  assertSafeName(TEST_DB_NAME)

  const client = new pg.Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: 'postgres',
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 5432,
  })

  await client.connect()

  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      TEST_DB_NAME,
    ])

    if (existing.rowCount === 0) {
      await client.query(`CREATE DATABASE "${TEST_DB_NAME}"`)
      console.log(`Created test database "${TEST_DB_NAME}"`)
    }
  } finally {
    await client.end()
  }

  const serverRoot = fileURLToPath(new URL('..', import.meta.url))

  execFileSync(process.execPath, ['db/migrate.mjs'], {
    cwd: serverRoot,
    env: { ...process.env, DB_NAME: TEST_DB_NAME },
    stdio: 'inherit',
  })
}
