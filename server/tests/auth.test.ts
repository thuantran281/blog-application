import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app, registerUser, resetDb } from './helpers.js'

describe('auth', () => {
  beforeEach(resetDb)

  it('registers a new user with a token and no password hash', async () => {
    const res = await request(app).post('/api/auth/register').send({
      username: 'alice',
      email: 'alice@example.com',
      password: 'password123',
    })

    expect(res.status).toBe(201)
    expect(res.body.data.user).toMatchObject({
      username: 'alice',
      email: 'alice@example.com',
      role: 'member',
    })
    expect(res.body.data.user.password_hash).toBeUndefined()
    expect(typeof res.body.data.token).toBe('string')
  })

  it('rejects a duplicate email case-insensitively with 409', async () => {
    await registerUser({ email: 'dupe@example.com' })

    const res = await request(app).post('/api/auth/register').send({
      username: 'another',
      email: 'DUPE@example.com',
      password: 'password123',
    })

    expect(res.status).toBe(409)
  })

  it('validates registration input', async () => {
    const res = await request(app).post('/api/auth/register').send({
      username: 'x',
      email: 'not-an-email',
      password: 'short',
    })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Validation failed')
    expect(Array.isArray(res.body.details)).toBe(true)
  })

  it('logs in with correct credentials and rejects a wrong password', async () => {
    const { user } = await registerUser()

    const ok = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email.toUpperCase(), password: user.password })

    expect(ok.status).toBe(200)
    expect(typeof ok.body.data.token).toBe('string')

    const bad = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'wrong-password' })

    expect(bad.status).toBe(401)
    expect(bad.body).toEqual({ error: 'Invalid email or password' })
  })

  it('protects /me and rejects invalid tokens', async () => {
    const noToken = await request(app).get('/api/auth/me')
    expect(noToken.status).toBe(401)

    const badToken = await request(app).get('/api/auth/me').set('Authorization', 'Bearer nope')
    expect(badToken.status).toBe(401)

    const { token, id, user } = await registerUser()
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)

    expect(me.status).toBe(200)
    expect(me.body.data).toMatchObject({ id, email: user.email })
  })
})
