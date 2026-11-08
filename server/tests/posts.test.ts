import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app, createPost, registerUser, resetDb } from './helpers.js'

describe('posts', () => {
  beforeEach(resetDb)

  it('requires auth to create a post', async () => {
    const res = await request(app).post('/api/posts').send({ title: 'X', content: 'Y' })
    expect(res.status).toBe(401)
  })

  it('creates a post with a generated slug, author, and published_at', async () => {
    const { token, id, user } = await registerUser()
    const post = await createPost(token, { title: 'Hello World', status: 'published' })

    expect(post).toMatchObject({
      title: 'Hello World',
      slug: 'hello-world',
      author_id: id,
      author_name: user.username,
      status: 'published',
    })
    expect(post.published_at).not.toBeNull()
  })

  it('supports custom and anonymous bylines', async () => {
    const { token, user } = await registerUser()

    const custom = await createPost(token, {
      title: 'Custom Byline',
      status: 'published',
      displayName: 'Pen Name',
    })
    expect(custom.author_name).toBe('Pen Name')

    const anonymous = await createPost(token, {
      title: 'Anonymous Post',
      status: 'published',
      displayName: null,
    })
    expect(anonymous.author_name).toBeNull()

    const listed = await request(app).get('/api/posts')
    expect(
      listed.body.data.find((post: { id: string }) => post.id === anonymous.id).author_name,
    ).toBeNull()

    const restored = await request(app)
      .patch(`/api/posts/${anonymous.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: user.username })

    expect(restored.status).toBe(200)
    expect(restored.body.data.author_name).toBe(user.username)
  })

  it('suffixes duplicate slugs', async () => {
    const { token } = await registerUser()
    const first = await createPost(token, { title: 'Same Title' })
    const second = await createPost(token, { title: 'Same Title' })

    expect(first.slug).toBe('same-title')
    expect(second.slug).toBe('same-title-2')
  })

  it('returns published posts by slug and hides drafts from non-authors', async () => {
    const author = await registerUser()
    const other = await registerUser()
    const draft = await createPost(author.token, { title: 'Secret Draft', status: 'draft' })

    expect((await request(app).get(`/api/posts/${draft.slug}`)).status).toBe(404)
    expect(
      (
        await request(app)
          .get(`/api/posts/${draft.slug}`)
          .set('Authorization', `Bearer ${other.token}`)
      ).status,
    ).toBe(404)
    expect(
      (
        await request(app)
          .get(`/api/posts/${draft.slug}`)
          .set('Authorization', `Bearer ${author.token}`)
      ).status,
    ).toBe(200)

    await request(app)
      .patch(`/api/posts/${draft.id}`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ status: 'published' })
      .expect(200)

    expect((await request(app).get(`/api/posts/${draft.slug}`)).status).toBe(200)
  })

  it('lets only the author update and delete the post', async () => {
    const author = await registerUser()
    const other = await registerUser()
    const post = await createPost(author.token)

    const forbidden = await request(app)
      .patch(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${other.token}`)
      .send({ title: 'Hijack' })
    expect(forbidden.status).toBe(403)

    const updated = await request(app)
      .patch(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({ title: 'Updated Post' })
    expect(updated.status).toBe(200)
    expect(updated.body.data.slug).toBe('updated-post')

    const forbiddenDelete = await request(app)
      .delete(`/api/posts/${post.id}`)
      .set('Authorization', `Bearer ${other.token}`)
    expect(forbiddenDelete.status).toBe(403)

    expect(
      (
        await request(app)
          .delete(`/api/posts/${post.id}`)
          .set('Authorization', `Bearer ${author.token}`)
      ).status,
    ).toBe(204)
    expect(
      (
        await request(app)
          .delete(`/api/posts/${post.id}`)
          .set('Authorization', `Bearer ${author.token}`)
      ).status,
    ).toBe(404)
  })

  it('lists posts with pagination metadata', async () => {
    const { token } = await registerUser()
    await createPost(token, { title: 'One', status: 'published' })
    await createPost(token, { title: 'Two', status: 'published' })

    const res = await request(app).get('/api/posts?page=1&limit=1')

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.meta).toMatchObject({ page: 1, limit: 1, total: 2, totalPages: 2 })
  })

  it('returns the author own posts including drafts', async () => {
    const author = await registerUser()
    const other = await registerUser()
    await createPost(author.token, { title: 'My Draft', status: 'draft' })
    await createPost(other.token, { title: 'Other Draft', status: 'draft' })

    const mine = await request(app)
      .get('/api/posts/mine')
      .set('Authorization', `Bearer ${author.token}`)

    expect(mine.status).toBe(200)
    expect(mine.body.meta.total).toBe(1)
    expect(mine.body.data[0].title).toBe('My Draft')
    expect(mine.body.data[0].author_name).toBe(author.user.username)

    const drafts = await request(app)
      .get('/api/posts/mine?status=draft')
      .set('Authorization', `Bearer ${author.token}`)

    expect(drafts.body.meta.total).toBe(1)
  })
})
