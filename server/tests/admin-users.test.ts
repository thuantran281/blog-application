import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app, registerAdmin, registerUser, resetDb } from './helpers.js'

describe('admin user management', () => {
  beforeEach(resetDb)

  it('requires admin access for every endpoint', async () => {
    const admin = await registerAdmin()
    const member = await registerUser()

    expect((await request(app).get('/api/admin/users')).status).toBe(401)
    expect(
      (await request(app).get('/api/admin/users').set('Authorization', `Bearer ${member.token}`))
        .status,
    ).toBe(403)

    const roleChange = await request(app)
      .patch(`/api/admin/users/${member.id}/role`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ role: 'admin' })
    expect(roleChange.status).toBe(403)

    const reset = await request(app)
      .post(`/api/admin/users/${admin.id}/reset-password`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ password: 'newpassword123', confirmPassword: 'newpassword123' })
    expect(reset.status).toBe(403)
  })

  it('lists and searches users with pagination', async () => {
    const admin = await registerAdmin()
    await registerUser({ username: 'Alice', email: 'alice@example.com' })
    await registerUser({ username: 'bob_user', email: 'bob@example.com' })

    const firstPage = await request(app)
      .get('/api/admin/users?page=1&limit=1')
      .set('Authorization', `Bearer ${admin.token}`)

    expect(firstPage.status).toBe(200)
    expect(firstPage.body.meta).toMatchObject({ page: 1, limit: 1, total: 3, totalPages: 3 })
    expect(firstPage.body.data).toHaveLength(1)
    expect(firstPage.body.data[0]).not.toHaveProperty('password_hash')

    const search = await request(app)
      .get('/api/admin/users?q=ALICE%40example.com')
      .set('Authorization', `Bearer ${admin.token}`)

    expect(search.body.meta.total).toBe(1)
    expect(search.body.data[0].username).toBe('Alice')
  })

  it('changes roles and revokes the affected user sessions', async () => {
    const admin = await registerAdmin()
    const member = await registerUser()

    const promoted = await request(app)
      .patch(`/api/admin/users/${member.id}/role`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ role: 'admin' })

    expect(promoted.status).toBe(200)
    expect(promoted.body.data.role).toBe('admin')
    expect(
      (await request(app).get('/api/auth/me').set('Authorization', `Bearer ${member.token}`))
        .status,
    ).toBe(401)

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: member.user.email, password: member.user.password })
    expect(login.body.data.user.role).toBe('admin')

    const demoted = await request(app)
      .patch(`/api/admin/users/${member.id}/role`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ role: 'viewer' })
    expect(demoted.body.data.role).toBe('viewer')
  })

  it('resets a password, revokes sessions, and validates the new password', async () => {
    const admin = await registerAdmin()
    const member = await registerUser()

    const mismatch = await request(app)
      .post(`/api/admin/users/${member.id}/reset-password`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ password: 'newpassword123', confirmPassword: 'different123' })
    expect(mismatch.status).toBe(400)

    const tooShort = await request(app)
      .post(`/api/admin/users/${member.id}/reset-password`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ password: 'short', confirmPassword: 'short' })
    expect(tooShort.status).toBe(400)

    const reset = await request(app)
      .post(`/api/admin/users/${member.id}/reset-password`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ password: 'newpassword123', confirmPassword: 'newpassword123' })

    expect(reset.status).toBe(200)
    expect(reset.body.data.username).toBe(member.user.username)
    expect(
      (await request(app).get('/api/auth/me').set('Authorization', `Bearer ${member.token}`))
        .status,
    ).toBe(401)
    expect(
      (
        await request(app)
          .post('/api/auth/login')
          .send({ email: member.user.email, password: member.user.password })
      ).status,
    ).toBe(401)

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: member.user.email, password: 'newpassword123' })
    expect(login.status).toBe(200)
  })

  it('prevents an admin from changing their own role or password', async () => {
    const admin = await registerAdmin()

    const roleChange = await request(app)
      .patch(`/api/admin/users/${admin.id}/role`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ role: 'member' })
    expect(roleChange.status).toBe(400)

    const reset = await request(app)
      .post(`/api/admin/users/${admin.id}/reset-password`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ password: 'newpassword123', confirmPassword: 'newpassword123' })
    expect(reset.status).toBe(400)

    expect(
      (await request(app).get('/api/auth/me').set('Authorization', `Bearer ${admin.token}`)).status,
    ).toBe(200)
  })

  it('returns 404 for unknown users', async () => {
    const admin = await registerAdmin()
    const unknown = randomUUID()

    expect(
      (
        await request(app)
          .patch(`/api/admin/users/${unknown}/role`)
          .set('Authorization', `Bearer ${admin.token}`)
          .send({ role: 'admin' })
      ).status,
    ).toBe(404)
    expect(
      (
        await request(app)
          .post(`/api/admin/users/${unknown}/reset-password`)
          .set('Authorization', `Bearer ${admin.token}`)
          .send({ password: 'newpassword123', confirmPassword: 'newpassword123' })
      ).status,
    ).toBe(404)
  })
})
