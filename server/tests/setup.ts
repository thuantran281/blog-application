import 'dotenv/config'
import { afterAll } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_NAME = process.env.TEST_DB_NAME ?? 'blog_db_test'

const { default: pool } = await import('../src/config/db.js')

afterAll(async () => {
  await pool.end()
})
