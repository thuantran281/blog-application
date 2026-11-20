import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app, createPost, registerAdmin, registerUser, resetDb } from './helpers.js'

async function addGuestComment(slug: string, content: string): Promise<string> {
  const res = await request(app)
    .post(`/api/posts/${slug}/comments`)
    .send({ content, guestName: 'Spammer' })

  expect(res.status).toBe(201)
  return res.body.data.id as string
}

describe('comment reports', () => {
  beforeEach(resetDb)

  it('counts one report per visitor and ignores duplicates', async () => {
    const { token } = await registerUser()
    const post = await createPost(token, { title: 'Reported Post', status: 'published' })
    const commentId = await addGuestComment(post.slug, 'Buy cheap watches')

    const first = await request(app)
      .post(`/api/comments/${commentId}/report`)
      .set('User-Agent', 'visitor-a')
    expect(first.status).toBe(201)
    expect(first.body.data).toMatchObject({ comment_id: commentId, report_count: 1 })

    const duplicate = await request(app)
      .post(`/api/comments/${commentId}/report`)
      .set('User-Agent', 'visitor-a')
    expect(duplicate.status).toBe(200)
    expect(duplicate.body.data.report_count).toBe(1)

    const otherVisitor = await request(app)
      .post(`/api/comments/${commentId}/report`)
      .set('User-Agent', 'visitor-b')
    expect(otherVisitor.status).toBe(201)
    expect(otherVisitor.body.data.report_count).toBe(2)
  })

  it('only lets admins list reports with post and comment details', async () => {
    const author = await registerUser()
    const admin = await registerAdmin()
    const post = await createPost(author.token, { title: 'Needs Review', status: 'published' })
    const commentId = await addGuestComment(post.slug, 'Spam content')

    await request(app).post(`/api/comments/${commentId}/report`).set('User-Agent', 'visitor-a')

    expect((await request(app).get('/api/admin/reports')).status).toBe(401)
    expect(
      (await request(app).get('/api/admin/reports').set('Authorization', `Bearer ${author.token}`))
        .status,
    ).toBe(403)

    const res = await request(app)
      .get('/api/admin/reports')
      .set('Authorization', `Bearer ${admin.token}`)

    expect(res.status).toBe(200)
    expect(res.body.meta).toMatchObject({ page: 1, total: 1, totalPages: 1 })
    expect(res.body.data[0]).toMatchObject({
      comment_id: commentId,
      content: 'Spam content',
      author_name: 'Spammer',
      post_title: 'Needs Review',
      post_slug: 'needs-review',
      report_count: 1,
    })
  })

  it('clears reports when an admin deletes the comment', async () => {
    const author = await registerUser()
    const admin = await registerAdmin()
    const post = await createPost(author.token, { title: 'Cleanup', status: 'published' })
    const commentId = await addGuestComment(post.slug, 'Remove me')

    await request(app).post(`/api/comments/${commentId}/report`).set('User-Agent', 'visitor-a')

    const deleted = await request(app)
      .delete(`/api/comments/${commentId}`)
      .set('Authorization', `Bearer ${admin.token}`)
    expect(deleted.status).toBe(204)

    const reports = await request(app)
      .get('/api/admin/reports')
      .set('Authorization', `Bearer ${admin.token}`)
    expect(reports.body.data).toEqual([])
    expect(reports.body.meta.total).toBe(0)
  })

  it('rejects invalid and unknown comment ids', async () => {
    expect((await request(app).post('/api/comments/not-a-uuid/report')).status).toBe(400)
    expect((await request(app).post(`/api/comments/${randomUUID()}/report`)).status).toBe(404)
  })
})
