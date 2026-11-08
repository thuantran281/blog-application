import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import {
  app,
  createCategory,
  createPost,
  createTag,
  registerAdmin,
  registerUser,
  resetDb,
} from './helpers.js'

describe('categories and tags', () => {
  beforeEach(resetDb)

  it('creates categories and tags with slugs and rejects duplicates', async () => {
    const { token } = await registerAdmin()

    const category = await createCategory(token, 'Backend Notes')
    expect(category.status).toBe(201)
    expect(category.body.data).toMatchObject({ name: 'Backend Notes', slug: 'backend-notes' })

    expect((await createCategory(token, 'Backend Notes')).status).toBe(409)

    const tag = await createTag(token, 'TypeScript')
    expect(tag.status).toBe(201)
    expect(tag.body.data.slug).toBe('typescript')
    expect((await createTag(token, 'TypeScript')).status).toBe(409)
  })

  it('updates taxonomy names longer than the legacy column limits', async () => {
    const { token } = await registerAdmin()
    const category = (await createCategory(token, 'Short Category')).body.data
    const tag = (await createTag(token, 'Short Tag')).body.data
    const longCategoryName = 'Category with a name long enough to exceed the legacy column limit'
    const longTagName = 'Tag with a name long enough to exceed legacy limits'

    const updatedCategory = await request(app)
      .patch(`/api/categories/${category.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: longCategoryName })
    expect(updatedCategory.status).toBe(200)
    expect(updatedCategory.body.data.name).toBe(longCategoryName)

    const updatedTag = await request(app)
      .patch(`/api/tags/${tag.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: longTagName })
    expect(updatedTag.status).toBe(200)
    expect(updatedTag.body.data.name).toBe(longTagName)
  })

  it('requires auth to create taxonomy entries', async () => {
    expect((await request(app).post('/api/categories').send({ name: 'X' })).status).toBe(401)
    expect((await request(app).post('/api/tags').send({ name: 'X' })).status).toBe(401)
  })

  it('requires admin to create, update, or delete taxonomy entries', async () => {
    const admin = await registerAdmin()
    const member = await registerUser()
    const category = (await createCategory(admin.token, 'Admin Category')).body.data
    const tag = (await createTag(admin.token, 'Admin Tag')).body.data

    expect((await createCategory(member.token, 'Member Category')).status).toBe(403)
    expect((await createTag(member.token, 'Member Tag')).status).toBe(403)

    expect(
      (
        await request(app)
          .patch(`/api/categories/${category.id}`)
          .set('Authorization', `Bearer ${member.token}`)
          .send({ name: 'Hijacked Category' })
      ).status,
    ).toBe(403)
    expect(
      (
        await request(app)
          .patch(`/api/tags/${tag.id}`)
          .set('Authorization', `Bearer ${member.token}`)
          .send({ name: 'Hijacked Tag' })
      ).status,
    ).toBe(403)

    expect(
      (
        await request(app)
          .delete(`/api/categories/${category.id}`)
          .set('Authorization', `Bearer ${member.token}`)
      ).status,
    ).toBe(403)
    expect(
      (
        await request(app)
          .delete(`/api/tags/${tag.id}`)
          .set('Authorization', `Bearer ${member.token}`)
      ).status,
    ).toBe(403)
  })

  it('attaches category and tags to posts and filters by them', async () => {
    const admin = await registerAdmin()
    const member = await registerUser()
    const category = (await createCategory(admin.token, 'Engineering')).body.data
    const node = (await createTag(admin.token, 'Node')).body.data
    const express = (await createTag(admin.token, 'Express')).body.data

    const post = await createPost(member.token, {
      title: 'Tagged Post',
      status: 'published',
      categoryId: category.id,
      tagIds: [node.id, express.id, node.id],
    })

    expect(post.category).toMatchObject({ id: category.id, slug: 'engineering' })
    expect(post.tags).toHaveLength(2)

    const byCategory = await request(app).get('/api/posts?category=engineering')
    expect(byCategory.body.meta.total).toBe(1)
    expect(byCategory.body.data[0].id).toBe(post.id)

    const byTag = await request(app).get('/api/posts?tag=node')
    expect(byTag.body.meta.total).toBe(1)
    expect(byTag.body.data[0].id).toBe(post.id)
  })

  it('rejects unknown relations and rolls back the post', async () => {
    const { token } = await registerUser()
    const missing = '00000000-0000-0000-0000-000000000000'

    const badCategory = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Bad Category', content: 'x', status: 'published', categoryId: missing })
    expect(badCategory.status).toBe(400)

    const badTag = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Bad Tag', content: 'x', status: 'published', tagIds: [missing] })
    expect(badTag.status).toBe(400)

    const list = await request(app).get('/api/posts?limit=50')
    expect(list.body.meta.total).toBe(0)
  })

  it('clears relations when a category or tag is deleted', async () => {
    const admin = await registerAdmin()
    const member = await registerUser()
    const category = (await createCategory(admin.token, 'Temp')).body.data
    const tag = (await createTag(admin.token, 'Temp Tag')).body.data
    const post = await createPost(member.token, {
      title: 'Relation Post',
      status: 'published',
      categoryId: category.id,
      tagIds: [tag.id],
    })

    await request(app)
      .delete(`/api/categories/${category.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(204)
    await request(app)
      .delete(`/api/tags/${tag.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(204)

    const detail = await request(app).get(`/api/posts/${post.slug}`)
    expect(detail.body.data.category).toBeNull()
    expect(detail.body.data.tags).toEqual([])
  })
})
