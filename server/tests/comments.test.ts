import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app, createPost, registerUser, resetDb } from './helpers.js'

describe('comments', () => {
  beforeEach(resetDb)

  it('allows guest comments with guestName and requires it when anonymous', async () => {
    const { token } = await registerUser()
    const post = await createPost(token, { title: 'Commentable', status: 'published' })

    const missing = await request(app)
      .post(`/api/posts/${post.slug}/comments`)
      .send({ content: 'Hi' })
    expect(missing.status).toBe(400)

    const guest = await request(app)
      .post(`/api/posts/${post.slug}/comments`)
      .send({ content: 'Hi', guestName: 'Guest' })

    expect(guest.status).toBe(201)
    expect(guest.body.data).toMatchObject({
      user_id: null,
      guest_name: 'Guest',
      author_name: 'Guest',
    })
  })

  it('uses the authenticated user identity for comments', async () => {
    const { token, user, id } = await registerUser()
    const post = await createPost(token, { title: 'Member Comment', status: 'published' })

    const res = await request(app)
      .post(`/api/posts/${post.slug}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Hello', guestName: 'Ignored' })

    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({
      user_id: id,
      guest_name: null,
      author_name: user.username,
    })
  })

  it('returns the same comment when a create request is retried', async () => {
    const { token } = await registerUser()
    const post = await createPost(token, { title: 'Retry Comment', status: 'published' })
    const clientRequestId = randomUUID()
    const body = { content: 'Only once', guestName: 'Guest', clientRequestId }

    const first = await request(app).post(`/api/posts/${post.slug}/comments`).send(body)
    const retried = await request(app).post(`/api/posts/${post.slug}/comments`).send(body)

    expect(first.status).toBe(201)
    expect(retried.status).toBe(201)
    expect(retried.body.data.id).toBe(first.body.data.id)

    const listed = await request(app).get(`/api/posts/${post.slug}/comments`)
    expect(listed.body.meta.total).toBe(1)
  })

  it('lists comments with pagination, oldest first', async () => {
    const { token } = await registerUser()
    const post = await createPost(token, { title: 'Listed', status: 'published' })
    await request(app)
      .post(`/api/posts/${post.slug}/comments`)
      .send({ content: 'first', guestName: 'A' })
    await request(app)
      .post(`/api/posts/${post.slug}/comments`)
      .send({ content: 'second', guestName: 'B' })

    const res = await request(app).get(`/api/posts/${post.slug}/comments?page=1&limit=1`)

    expect(res.status).toBe(200)
    expect(res.body.meta).toMatchObject({ total: 2, totalPages: 2 })
    expect(res.body.data[0].content).toBe('first')
  })

  it('only lets the comment author or an admin delete', async () => {
    const author = await registerUser()
    const other = await registerUser()
    const post = await createPost(author.token, { title: 'Delete Comment', status: 'published' })

    const comment = await request(app)
      .post(`/api/posts/${post.slug}/comments`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ content: 'mine' })

    expect(
      (
        await request(app)
          .delete(`/api/comments/${comment.body.data.id}`)
          .set('Authorization', `Bearer ${other.token}`)
      ).status,
    ).toBe(403)
    expect(
      (
        await request(app)
          .delete(`/api/comments/${comment.body.data.id}`)
          .set('Authorization', `Bearer ${author.token}`)
      ).status,
    ).toBe(204)
  })

  it('hides comments for drafts and missing posts', async () => {
    const { token } = await registerUser()
    const draft = await createPost(token, { title: 'Hidden', status: 'draft' })

    expect((await request(app).get(`/api/posts/${draft.slug}/comments`)).status).toBe(404)
    expect(
      (
        await request(app)
          .post(`/api/posts/${draft.slug}/comments`)
          .send({ content: 'x', guestName: 'G' })
      ).status,
    ).toBe(404)
    expect((await request(app).get('/api/posts/missing/comments')).status).toBe(404)
  })
})
