import request from 'supertest'
import app from '../src/app.js'
import pool from '../src/config/db.js'

export { app, pool }

let counter = 0

function uniqueSuffix() {
  counter += 1
  return `${Date.now()}_${counter}`
}

export async function resetDb() {
  await pool.query(
    'TRUNCATE TABLE post_tags, comments, posts, categories, tags, users RESTART IDENTITY CASCADE',
  )
}

interface UserOverrides {
  username?: string
  email?: string
  password?: string
}

export async function registerUser(overrides: UserOverrides = {}) {
  const suffix = uniqueSuffix()
  const user = {
    username: `user_${suffix}`,
    email: `user_${suffix}@example.com`,
    password: 'password123',
    ...overrides,
  }

  const response = await request(app).post('/api/auth/register').send(user)

  if (response.status !== 201) {
    throw new Error(`registerUser failed: ${response.status} ${JSON.stringify(response.body)}`)
  }

  return {
    user,
    id: response.body.data.user.id as string,
    token: response.body.data.token as string,
  }
}

export async function registerAdmin(overrides: UserOverrides = {}) {
  const registered = await registerUser(overrides)

  await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [registered.id])

  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: registered.user.email, password: registered.user.password })

  if (login.status !== 200) {
    throw new Error(`registerAdmin login failed: ${login.status} ${JSON.stringify(login.body)}`)
  }

  return {
    ...registered,
    token: login.body.data.token as string,
  }
}

interface PostOverrides {
  title?: string
  content?: string
  excerpt?: string
  status?: 'draft' | 'published'
  categoryId?: string | null
  tagIds?: string[]
  displayName?: string | null
}

export async function createPost(token: string, overrides: PostOverrides = {}) {
  const response = await request(app)
    .post('/api/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: `Post ${uniqueSuffix()}`,
      content: 'Post content',
      ...overrides,
    })

  if (response.status !== 201) {
    throw new Error(`createPost failed: ${response.status} ${JSON.stringify(response.body)}`)
  }

  return response.body.data
}

export async function createCategory(token: string, name: string) {
  const response = await request(app)
    .post('/api/categories')
    .set('Authorization', `Bearer ${token}`)
    .send({ name })

  return response
}

export async function createTag(token: string, name: string) {
  const response = await request(app)
    .post('/api/tags')
    .set('Authorization', `Bearer ${token}`)
    .send({ name })

  return response
}
