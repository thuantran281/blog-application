export type UserRole = 'admin' | 'member' | 'viewer'
export type PostStatus = 'draft' | 'published'

export interface AuthUser {
  id: string
  username: string
  email: string
  role: UserRole
}

export interface AuthResponse {
  user: AuthUser
  token: string
}

export interface Category {
  id: string
  name: string
  slug: string
  created_at: string
}

export interface Tag {
  id: string
  name: string
  slug: string
  created_at: string
}

export interface PostSummary {
  id: string
  title: string
  slug: string
  excerpt: string | null
  status: PostStatus
  created_at: string
  updated_at: string
  published_at: string | null
  author_name: string | null
}

export interface PostCategory {
  id: string
  name: string
  slug: string
}

export interface PostTag {
  id: string
  name: string
  slug: string
}

export interface Post extends PostSummary {
  content: string
  author_id: string | null
  category_id: string | null
  category: PostCategory | null
  tags: PostTag[]
}

export interface Comment {
  id: string
  post_id: string
  user_id: string | null
  guest_name: string | null
  content: string
  created_at: string
  author_name: string
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface Paginated<T> {
  data: T[]
  meta: PaginationMeta
}

export interface RegisterInput {
  username: string
  email: string
  password: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface CreatePostInput {
  title: string
  content: string
  excerpt?: string
  status: PostStatus
  categoryId?: string | null
  tagIds?: string[]
  displayName?: string | null
}

export interface UpdatePostInput {
  title?: string
  content?: string
  excerpt?: string | null
  status?: PostStatus
  categoryId?: string | null
  tagIds?: string[]
  displayName?: string | null
}

export interface CreateCommentInput {
  content: string
  guestName?: string
}
