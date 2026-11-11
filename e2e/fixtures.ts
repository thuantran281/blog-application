import { expect, test as base } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'

export const adminCredentials = {
  username: process.env.E2E_ADMIN_USERNAME ?? 'postman_admin',
  email: process.env.E2E_ADMIN_EMAIL ?? 'postman_admin@example.com',
  password: process.env.E2E_ADMIN_PASSWORD ?? 'password123',
}

interface AuthData {
  token: string
  user: {
    id: string
    username: string
    email: string
    role: string
  }
}

interface CreatedPost {
  id: string
  title: string
  slug: string
  status: string
}

export interface E2ERun {
  prefix: string
}

async function apiLogin(request: APIRequestContext): Promise<AuthData> {
  const response = await request.post('/api/auth/login', {
    data: {
      email: adminCredentials.email,
      password: adminCredentials.password,
    },
  })

  if (!response.ok()) {
    throw new Error(`Admin login failed (${response.status()}): ${await response.text()}`)
  }

  const body = (await response.json()) as { data: AuthData }
  return body.data
}

export async function loginViaUi(page: Page): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('Email').fill(adminCredentials.email)
  await page.getByLabel('Password').fill(adminCredentials.password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible()
}

export async function createPostViaApi(
  request: APIRequestContext,
  input: { title: string; content: string; status?: 'draft' | 'published' },
): Promise<CreatedPost> {
  const auth = await apiLogin(request)
  const response = await request.post('/api/posts', {
    headers: {
      Authorization: `Bearer ${auth.token}`,
    },
    data: {
      title: input.title,
      content: input.content,
      status: input.status ?? 'published',
      displayName: auth.user.username,
    },
  })

  if (response.status() !== 201) {
    throw new Error(`Creating post failed (${response.status()}): ${await response.text()}`)
  }

  const body = (await response.json()) as { data: CreatedPost }
  return body.data
}

async function cleanupPosts(request: APIRequestContext, prefix: string): Promise<void> {
  const auth = await apiLogin(request)
  const headers = { Authorization: `Bearer ${auth.token}` }
  const postsToDelete: CreatedPost[] = []

  for (let page = 1; ; page += 1) {
    const response = await request.get(`/api/posts/mine?page=${page}&limit=50`, { headers })

    if (!response.ok()) {
      throw new Error(`Listing admin posts failed (${response.status()}): ${await response.text()}`)
    }

    const body = (await response.json()) as {
      data: CreatedPost[]
      meta: { totalPages: number }
    }

    postsToDelete.push(...body.data.filter((post) => post.title.startsWith(prefix)))

    if (page >= body.meta.totalPages) {
      break
    }
  }

  for (const post of postsToDelete) {
    const response = await request.delete(`/api/posts/${post.id}`, { headers })
    expect(response.status(), `Deleting test post "${post.title}"`).toBe(204)
  }
}

export const test = base.extend<{ e2eRun: E2ERun }>({
  e2eRun: async ({ request }, use, testInfo) => {
    const label = testInfo.title
      .replace(/[^a-z0-9]+/gi, ' ')
      .trim()
      .slice(0, 40)

    const prefix = `E2E ${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    await use({ prefix })
    await cleanupPosts(request, prefix)
  },
})

export { expect }
