import 'dotenv/config'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import { afterAll } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.DB_NAME = process.env.TEST_DB_NAME ?? 'blog_db_test'
process.env.UPLOAD_DIR = path.resolve('uploads-test')
process.env.MAX_UPLOAD_BYTES = '2048'
process.env.UPLOAD_CLEANUP_GRACE_MINUTES = '0'

const { default: pool } = await import('../src/config/db.js')

afterAll(async () => {
  await pool.end()
  await rm(process.env.UPLOAD_DIR!, { recursive: true, force: true })
})
