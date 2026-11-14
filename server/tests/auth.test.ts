import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app, registerUser, resetDb } from './helpers.js'

function setCookieHeaders(res: { headers: unknown }): string[] {
  const headers = res.headers as Record<string, string | string[] | undefined>
  const header = headers['set-cookie']

  if (Array.isArray(header)) {
    return header
  }

  return header ? [header] : []
}

function cookieValue(res: { headers: unknown }, name: string): string | null {
  const prefix = `${name}=`
  const cookie = setCookieHeaders(res).find((value) => value.startsWith(prefix))

  if (!cookie) {
    return null
  }

  const [value] = cookie.slice(prefix.length).split(';')

  return value ?? null
}

describe('auth', () => {
  beforeEach(resetDb)

  it('registers a new user with a session cookie and no password hash', async () => {
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
    expect(cookieValue(res, 'blog_session')).toBeTruthy()
    expect(cookieValue(res, 'blog_csrf')).toBeTruthy()

    const sessionCookie = setCookieHeaders(res).find((value) => value.startsWith('blog_session='))

    expect(sessionCookie).toMatch(/HttpOnly/i)
    expect(sessionCookie).toMatch(/SameSite=Lax/i)
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
    expect(cookieValue(ok, 'blog_session')).toBeTruthy()
    expect(cookieValue(ok, 'blog_csrf')).toBeTruthy()

    const bad = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'wrong-password' })

    expect(bad.status).toBe(401)
    expect(bad.body).toEqual({ error: 'Invalid email or password' })
  })

  it('allows login with an existing session without a CSRF header', async () => {
    const { user } = await registerUser()
    const agent = request.agent(app)

    const first = await agent
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password })
    const second = await agent
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password })
    const staleHeader = await agent
      .post('/api/auth/login')
      .set('Authorization', 'Bearer stale-token')
      .send({ email: user.email, password: user.password })

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(staleHeader.status).toBe(200)
  })

  it('protects /me and rejects invalid tokens', async () => {
    const noToken = await request(app).get('/api/auth/me')
    expect(noToken.status).toBe(401)

    const badToken = await request(app).get('/api/auth/me').set('Authorization', 'Bearer nope')
    expect(badToken.status).toBe(401)

    const badCookie = await request(app).get('/api/auth/me').set('Cookie', 'blog_session=nope')
    expect(badCookie.status).toBe(401)

    const { token, id, user } = await registerUser()
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)

    expect(me.status).toBe(200)
    expect(me.body.data).toMatchObject({ id, email: user.email })
  })

  it('issues a CSRF token', async () => {
    const res = await request(app).get('/api/auth/csrf')

    expect(res.status).toBe(200)
    expect(typeof res.body.data.csrfToken).toBe('string')
    expect(cookieValue(res, 'blog_csrf')).toBe(res.body.data.csrfToken)
  })

  it('authenticates with the session cookie and requires CSRF for writes', async () => {
    const agent = request.agent(app)
    const registration = await agent.post('/api/auth/register').send({
      username: 'cookie_user',
      email: 'cookie@example.com',
      password: 'password123',
    })
    const csrfToken = cookieValue(registration, 'blog_csrf')

    expect(registration.status).toBe(201)

    if (!csrfToken) {
      throw new Error('Expected a CSRF cookie')
    }

    const me = await agent.get('/api/auth/me')
    expect(me.status).toBe(200)
    expect(me.body.data.email).toBe('cookie@example.com')

    const blocked = await agent.post('/api/posts').send({
      title: 'Cookie post',
      content: 'Written with a session cookie.',
    })

    expect(blocked.status).toBe(403)
    expect(blocked.body).toEqual({ error: 'Invalid CSRF token' })

    const created = await agent.post('/api/posts').set('X-CSRF-Token', csrfToken).send({
      title: 'Cookie post',
      content: 'Written with a session cookie.',
    })

    expect(created.status).toBe(201)
  })

  it('keeps bearer authentication working without CSRF', async () => {
    const { token } = await registerUser()

    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Bearer post', content: 'Written with a bearer token.' })

    expect(res.status).toBe(201)
  })

  it('clears session and CSRF cookies on logout', async () => {
    const agent = request.agent(app)
    const registration = await agent.post('/api/auth/register').send({
      username: 'logout_user',
      email: 'logout@example.com',
      password: 'password123',
    })
    const csrfToken = cookieValue(registration, 'blog_csrf')

    if (!csrfToken) {
      throw new Error('Expected a CSRF cookie')
    }

    const logout = await agent.post('/api/auth/logout').set('X-CSRF-Token', csrfToken)

    expect(logout.status).toBe(204)
    expect(cookieValue(logout, 'blog_session')).toBe('')
    expect(cookieValue(logout, 'blog_csrf')).toBe('')

    const me = await agent.get('/api/auth/me')
    expect(me.status).toBe(401)
  })
})
