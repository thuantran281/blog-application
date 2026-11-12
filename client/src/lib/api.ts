import type {
  AuthResponse,
  AuthUser,
  Category,
  Comment,
  CreateCommentInput,
  CreatePostInput,
  LoginInput,
  Paginated,
  Post,
  PostSummary,
  RegisterInput,
  Tag,
  UpdatePostInput,
} from '../types'

const API_URL = (
  import.meta.env.VITE_API_URL ??
  (import.meta.env.MODE === 'development' ? 'http://localhost:3000' : '')
).replace(/\/+$/, '')
const TOKEN_KEY = 'blog-api-token'

export class ApiError extends Error {
  readonly status: number
  readonly details: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function storeToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

function toQuery(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value))
    }
  }

  const query = search.toString()
  return query ? `?${query}` : ''
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const token = getStoredToken()

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_URL}${path}`, { ...init, headers })

  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()
  let body: unknown = null

  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = null
    }
  }

  if (!response.ok) {
    const errorBody = body as { error?: unknown; details?: unknown } | null
    const message =
      typeof errorBody?.error === 'string' ? errorBody.error : `Request failed (${response.status})`

    throw new ApiError(response.status, message, errorBody?.details)
  }

  return body as T
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong'
}

export const api = {
  register(input: RegisterInput) {
    return request<{ data: AuthResponse }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((response) => response.data)
  },

  login(input: LoginInput) {
    return request<{ data: AuthResponse }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((response) => response.data)
  },

  me() {
    return request<{ data: AuthUser }>('/api/auth/me').then((response) => response.data)
  },

  listPosts(params: {
    page?: number
    limit?: number
    category?: string
    tag?: string
  }): Promise<Paginated<PostSummary>> {
    return request<Paginated<PostSummary>>(
      `/api/posts${toQuery({
        page: params.page,
        limit: params.limit,
        category: params.category,
        tag: params.tag,
      })}`,
    )
  },

  listMyPosts(params: {
    page?: number
    limit?: number
    status?: 'draft' | 'published'
  }): Promise<Paginated<PostSummary>> {
    return request<Paginated<PostSummary>>(
      `/api/posts/mine${toQuery({
        page: params.page,
        limit: params.limit,
        status: params.status,
      })}`,
    )
  },

  getPost(slug: string) {
    return request<{ data: Post }>(`/api/posts/${encodeURIComponent(slug)}`).then(
      (response) => response.data,
    )
  },

  createPost(input: CreatePostInput) {
    return request<{ data: Post }>('/api/posts', {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((response) => response.data)
  },

  updatePost(id: string, input: UpdatePostInput) {
    return request<{ data: Post }>(`/api/posts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }).then((response) => response.data)
  },

  deletePost(id: string) {
    return request<void>(`/api/posts/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  listCategories() {
    return request<{ data: Category[] }>('/api/categories').then((response) => response.data)
  },

  createCategory(name: string) {
    return request<{ data: Category }>('/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }).then((response) => response.data)
  },

  updateCategory(id: string, name: string) {
    return request<{ data: Category }>(`/api/categories/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }).then((response) => response.data)
  },

  deleteCategory(id: string) {
    return request<void>(`/api/categories/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  listTags() {
    return request<{ data: Tag[] }>('/api/tags').then((response) => response.data)
  },

  createTag(name: string) {
    return request<{ data: Tag }>('/api/tags', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }).then((response) => response.data)
  },

  updateTag(id: string, name: string) {
    return request<{ data: Tag }>(`/api/tags/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }).then((response) => response.data)
  },

  deleteTag(id: string) {
    return request<void>(`/api/tags/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  listComments(slug: string, params: { page?: number; limit?: number }) {
    return request<Paginated<Comment>>(
      `/api/posts/${encodeURIComponent(slug)}/comments${toQuery({
        page: params.page,
        limit: params.limit,
      })}`,
    )
  },

  createComment(slug: string, input: CreateCommentInput) {
    return request<{ data: Comment }>(`/api/posts/${encodeURIComponent(slug)}/comments`, {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((response) => response.data)
  },

  deleteComment(id: string) {
    return request<void>(`/api/comments/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },
}
