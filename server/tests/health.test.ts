import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { app } from './helpers.js'

describe('production middleware', () => {
  it('reports liveness with a request id', async () => {
    const response = await request(app).get('/health/live')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok' })
    expect(response.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })

  it('reports readiness when the database is reachable', async () => {
    const response = await request(app).get('/health/ready')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok' })
  })

  it('sets security headers', async () => {
    const response = await request(app).get('/health/live')

    expect(response.headers['x-content-type-options']).toBe('nosniff')
    expect(response.headers['content-security-policy']).toBeDefined()
  })

  it('allows configured origins and omits CORS headers for others', async () => {
    const allowed = await request(app).get('/health/live').set('Origin', 'http://localhost:5173')

    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173')

    const denied = await request(app).get('/health/live').set('Origin', 'https://evil.example')

    expect(denied.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('rejects malformed JSON with 400', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"broken"')

    expect(response.status).toBe(400)
    expect(response.body).toEqual({ error: 'Invalid JSON' })
  })

  it('rejects oversized JSON payloads with 413', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send(
        JSON.stringify({
          username: 'oversized_user',
          email: 'oversized@example.com',
          password: 'password123',
          padding: 'x'.repeat(200 * 1024),
        }),
      )

    expect(response.status).toBe(413)
    expect(response.body).toEqual({ error: 'Payload too large' })
  })
})
