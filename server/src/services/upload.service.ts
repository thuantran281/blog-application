import { randomUUID } from 'node:crypto'
import type { Dirent } from 'node:fs'
import { mkdir, readdir, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { env } from '../config/env.js'
import pool from '../config/db.js'
import { HttpError } from '../middleware/error.js'

const IMAGE_TYPES = [
  {
    mimeType: 'image/png',
    extension: 'png',
    matches: (buffer: Buffer) =>
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  },
  {
    mimeType: 'image/jpeg',
    extension: 'jpg',
    matches: (buffer: Buffer) =>
      buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  },
  {
    mimeType: 'image/gif',
    extension: 'gif',
    matches: (buffer: Buffer) =>
      buffer.length >= 6 &&
      (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' ||
        buffer.subarray(0, 6).toString('ascii') === 'GIF89a'),
  },
  {
    mimeType: 'image/webp',
    extension: 'webp',
    matches: (buffer: Buffer) =>
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP',
  },
] as const

export const UPLOAD_FILENAME_PATTERN = /^[0-9a-f-]{36}\.(?:png|jpg|gif|webp)$/
const UPLOAD_URL_PATTERN = /\/uploads\/([0-9a-f-]{36}\.(?:png|jpg|gif|webp))/gi

interface ImageType {
  mimeType: string
  extension: string
}

export interface StoredImage {
  url: string
  filename: string
  mimeType: string
  byteSize: number
}

interface CleanupOptions {
  uploadDir?: string
  now?: Date
  graceMinutes?: number
}

export interface CleanupResult {
  deleted: string[]
  referenced: number
  recent: number
  failed: string[]
}

function normalizeMimeType(mimeType: string): string {
  return mimeType.toLowerCase() === 'image/jpg' ? 'image/jpeg' : mimeType.toLowerCase()
}

export function detectImageType(buffer: Buffer): ImageType | null {
  const type = IMAGE_TYPES.find((candidate) => candidate.matches(buffer))
  return type ? { mimeType: type.mimeType, extension: type.extension } : null
}

export async function storeImage(buffer: Buffer, declaredMimeType: string): Promise<StoredImage> {
  const detected = detectImageType(buffer)

  if (!detected) {
    throw new HttpError(400, 'Only PNG, JPEG, GIF, and WebP images are supported')
  }

  if (normalizeMimeType(declaredMimeType) !== detected.mimeType) {
    throw new HttpError(400, 'The image contents do not match its file type')
  }

  const filename = `${randomUUID()}.${detected.extension}`
  const uploadDir = path.resolve(env.UPLOAD_DIR)

  await mkdir(uploadDir, { recursive: true })
  await writeFile(path.join(uploadDir, filename), buffer, { flag: 'wx' })

  return {
    url: `/uploads/${filename}`,
    filename,
    mimeType: detected.mimeType,
    byteSize: buffer.length,
  }
}

async function referencedFilenames(): Promise<Set<string>> {
  const result = await pool.query<{ content: string }>('SELECT content FROM posts')
  const references = new Set<string>()

  for (const row of result.rows) {
    if (typeof row.content !== 'string') {
      continue
    }

    for (const match of row.content.matchAll(UPLOAD_URL_PATTERN)) {
      if (match[1]) {
        references.add(match[1])
      }
    }
  }

  return references
}

export async function cleanupOrphanedUploads(options: CleanupOptions = {}): Promise<CleanupResult> {
  const uploadDir = path.resolve(options.uploadDir ?? env.UPLOAD_DIR)
  const graceMs = (options.graceMinutes ?? env.UPLOAD_CLEANUP_GRACE_MINUTES) * 60_000
  const nowMs = (options.now ?? new Date()).getTime()
  const result: CleanupResult = { deleted: [], referenced: 0, recent: 0, failed: [] }

  let entries: Dirent[]
  let references: Set<string>

  try {
    entries = await readdir(uploadDir, { withFileTypes: true })
    references = await referencedFilenames()
  } catch (err) {
    throw new HttpError(500, 'Could not scan uploaded images', err)
  }

  for (const entry of entries) {
    if (!entry.isFile() || !UPLOAD_FILENAME_PATTERN.test(entry.name)) {
      continue
    }

    if (references.has(entry.name)) {
      result.referenced += 1
      continue
    }

    try {
      const details = await stat(path.join(uploadDir, entry.name))

      if (nowMs - details.mtimeMs < graceMs) {
        result.recent += 1
        continue
      }

      await unlink(path.join(uploadDir, entry.name))
      result.deleted.push(entry.name)
    } catch {
      result.failed.push(entry.name)
    }
  }

  return result
}
