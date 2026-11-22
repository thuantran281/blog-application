import { readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import request from 'supertest'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { env } from '../src/config/env.js'
import { cleanupOrphanedUploads, UPLOAD_FILENAME_PATTERN } from '../src/services/upload.service.js'
import { app, createPost, registerUser, resetDb } from './helpers.js'

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='
const pngBuffer = Buffer.from(PNG_BASE64, 'base64')

function upload(buffer = pngBuffer, contentType = 'image/png') {
  return request(app)
    .post('/api/uploads')
    .attach('image', buffer, { filename: 'pixel.png', contentType })
}

describe('image uploads', () => {
  beforeEach(async () => {
    await resetDb()
    await rm(env.UPLOAD_DIR, { recursive: true, force: true })
  })

  afterAll(async () => {
    await rm(env.UPLOAD_DIR, { recursive: true, force: true })
  })

  it('requires authentication', async () => {
    const response = await upload()
    expect(response.status).toBe(401)
  })

  it('stores a validated image and serves it by its generated filename', async () => {
    const { token } = await registerUser()

    const response = await upload().set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(201)
    expect(response.body.data).toMatchObject({
      url: expect.stringMatching(/^\/uploads\/[0-9a-f-]+\.png$/),
      filename: expect.stringMatching(UPLOAD_FILENAME_PATTERN),
      mimeType: 'image/png',
      byteSize: pngBuffer.length,
    })

    const filename = response.body.data.filename as string
    const stored = await readFile(path.join(env.UPLOAD_DIR, filename))
    expect(stored.equals(pngBuffer)).toBe(true)

    const served = await request(app).get(`/uploads/${filename}`)
    expect(served.status).toBe(200)
    expect(served.headers['content-type']).toContain('image/png')
  })

  it('rejects non-image files and mismatched image contents', async () => {
    const { token } = await registerUser()

    const text = await upload(Buffer.from('not an image'), 'text/plain').set(
      'Authorization',
      `Bearer ${token}`,
    )
    expect(text.status).toBe(400)
    expect(text.body.error).toMatch(/PNG|JPEG|GIF|WebP/)

    const mismatched = await upload(pngBuffer, 'image/jpeg').set('Authorization', `Bearer ${token}`)
    expect(mismatched.status).toBe(400)
    expect(mismatched.body.error).toMatch(/do not match/)
  })

  it('rejects files over the configured limit', async () => {
    const { token } = await registerUser()

    const response = await upload(Buffer.alloc(4096, 1), 'image/png').set(
      'Authorization',
      `Bearer ${token}`,
    )

    expect(response.status).toBe(413)
    expect(response.body.error).toBe('Image is too large')
  })

  it('deletes only unreferenced uploads older than the grace period', async () => {
    const { token } = await registerUser()

    const referenced = await upload().set('Authorization', `Bearer ${token}`)
    const orphan = await upload().set('Authorization', `Bearer ${token}`)

    await createPost(token, {
      content: `![pixel](${referenced.body.data.url})`,
      status: 'published',
    })

    const result = await cleanupOrphanedUploads({ now: new Date(Date.now() + 60_000) })

    expect(result.deleted).toContain(orphan.body.data.filename)
    expect(result.deleted).not.toContain(referenced.body.data.filename)
    expect(result.referenced).toBe(1)

    await expect(readFile(path.join(env.UPLOAD_DIR, orphan.body.data.filename))).rejects.toThrow()
    await expect(
      readFile(path.join(env.UPLOAD_DIR, referenced.body.data.filename)),
    ).resolves.toBeDefined()
  })
})
