import pool from '../config/db.js'
import { cleanupOrphanedUploads } from '../services/upload.service.js'

try {
  const result = await cleanupOrphanedUploads()

  console.log(
    `Upload cleanup: deleted ${result.deleted.length}, referenced ${result.referenced}, recent ${result.recent}, failed ${result.failed.length}.`,
  )

  if (result.failed.length > 0) {
    console.error(`Could not remove: ${result.failed.join(', ')}`)
    process.exitCode = 1
  }
} catch (err) {
  console.error('Upload cleanup failed:', err instanceof Error ? err.message : err)
  process.exitCode = 1
} finally {
  await pool.end()
}
