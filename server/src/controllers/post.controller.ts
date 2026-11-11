import type { Request, Response } from 'express'
import { getAuthUser } from '../middleware/auth.js'
import { HttpError } from '../middleware/error.js'
import {
  createPostSchema,
  listPostsQuerySchema,
  myPostsQuerySchema,
  postIdParamSchema,
  postSlugParamSchema,
  updatePostSchema,
} from '../schemas/post.schema.js'
import {
  CategoryNotFoundError,
  createPost as createPostRecord,
  deletePost as deletePostRecord,
  findPostBySlug,
  listMyPosts as listMyPostsRecord,
  listPublishedPosts,
  PostAccessError,
  PostIdempotencyConflictError,
  PostVersionConflictError,
  SlugConflictError,
  TagNotFoundError,
  updatePost as updatePostRecord,
  type PostWithRelations,
} from '../services/post.service.js'

export async function listPosts(req: Request, res: Response) {
  const { page, limit, category, tag } = listPostsQuerySchema.parse(req.query)
  const result = await listPublishedPosts({ page, limit, category, tag })
  res.json(result)
}

export async function listMyPosts(req: Request, res: Response) {
  const user = getAuthUser(req)
  const { page, limit, status } = myPostsQuerySchema.parse(req.query)
  const result = await listMyPostsRecord(user.id, { page, limit, status })

  res.json(result)
}

export async function getPost(req: Request, res: Response) {
  const { slug } = postSlugParamSchema.parse(req.params)
  const post = await findPostBySlug(slug)

  if (!post) {
    throw new HttpError(404, 'Post not found')
  }

  if (post.status !== 'published') {
    const user = req.user
    const canViewDraft = user !== undefined && (user.role === 'admin' || post.author_id === user.id)

    if (!canViewDraft) {
      throw new HttpError(404, 'Post not found')
    }
  }

  res.json({ data: post })
}

export async function createPost(req: Request, res: Response) {
  const user = getAuthUser(req)
  const input = createPostSchema.parse(req.body)

  let post: PostWithRelations
  try {
    post = await createPostRecord({
      title: input.title,
      content: input.content,
      excerpt: input.excerpt ?? null,
      status: input.status,
      authorId: user.id,
      authorDisplayName: input.displayName === undefined ? user.username : input.displayName,
      categoryId: input.categoryId ?? null,
      tagIds: input.tagIds ?? [],
      clientRequestId: input.clientRequestId ?? null,
    })
  } catch (err) {
    if (err instanceof SlugConflictError || err instanceof PostIdempotencyConflictError) {
      throw new HttpError(409, err.message)
    }

    if (err instanceof CategoryNotFoundError || err instanceof TagNotFoundError) {
      throw new HttpError(400, err.message)
    }

    throw err
  }

  res.status(201).location(`/api/posts/${post.slug}`).json({ data: post })
}

export async function updatePost(req: Request, res: Response) {
  const user = getAuthUser(req)
  const { id } = postIdParamSchema.parse(req.params)
  const input = updatePostSchema.parse(req.body)

  let post: PostWithRelations | null
  try {
    post = await updatePostRecord(id, input, user)
  } catch (err) {
    if (err instanceof SlugConflictError) {
      throw new HttpError(409, err.message)
    }

    if (err instanceof PostVersionConflictError) {
      throw new HttpError(409, err.message, { current: err.current })
    }

    if (err instanceof PostAccessError) {
      throw new HttpError(403, err.message)
    }

    if (err instanceof CategoryNotFoundError || err instanceof TagNotFoundError) {
      throw new HttpError(400, err.message)
    }

    throw err
  }

  if (!post) {
    throw new HttpError(404, 'Post not found')
  }

  res.json({ data: post })
}

export async function deletePost(req: Request, res: Response) {
  const user = getAuthUser(req)
  const { id } = postIdParamSchema.parse(req.params)

  let deleted: boolean
  try {
    deleted = await deletePostRecord(id, user)
  } catch (err) {
    if (err instanceof PostAccessError) {
      throw new HttpError(403, err.message)
    }

    throw err
  }

  if (!deleted) {
    throw new HttpError(404, 'Post not found')
  }

  res.status(204).send()
}
