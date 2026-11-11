import type { Request, Response } from 'express'
import { getAuthUser } from '../middleware/auth.js'
import { HttpError } from '../middleware/error.js'
import { postSlugParamSchema } from '../schemas/post.schema.js'
import {
  commentIdParamSchema,
  createCommentSchema,
  listCommentsQuerySchema,
} from '../schemas/comment.schema.js'
import {
  CommentIdempotencyConflictError,
  createComment as createCommentRecord,
  deleteComment as deleteCommentRecord,
  findCommentById,
  findPublishedPostIdBySlug,
  listCommentsByPostId,
  type Comment,
} from '../services/comment.service.js'

export async function listComments(req: Request, res: Response) {
  const { slug } = postSlugParamSchema.parse(req.params)
  const postId = await findPublishedPostIdBySlug(slug)

  if (!postId) {
    throw new HttpError(404, 'Post not found')
  }

  const { page, limit } = listCommentsQuerySchema.parse(req.query)
  const result = await listCommentsByPostId(postId, { page, limit })

  res.json(result)
}

export async function createComment(req: Request, res: Response) {
  const { slug } = postSlugParamSchema.parse(req.params)
  const postId = await findPublishedPostIdBySlug(slug)

  if (!postId) {
    throw new HttpError(404, 'Post not found')
  }

  const input = createCommentSchema.parse(req.body)
  const user = req.user
  const guestName = user ? null : (input.guestName ?? null)

  if (!user && !guestName) {
    throw new HttpError(400, 'guestName is required when not authenticated')
  }

  let comment: Comment
  try {
    comment = await createCommentRecord({
      postId,
      userId: user?.id ?? null,
      guestName,
      content: input.content,
      clientRequestId: input.clientRequestId ?? null,
    })
  } catch (err) {
    if (err instanceof CommentIdempotencyConflictError) {
      throw new HttpError(409, err.message)
    }

    throw err
  }

  res.status(201).location(`/api/comments/${comment.id}`).json({ data: comment })
}

export async function deleteComment(req: Request, res: Response) {
  const user = getAuthUser(req)
  const { id } = commentIdParamSchema.parse(req.params)
  const comment = await findCommentById(id)

  if (!comment) {
    throw new HttpError(404, 'Comment not found')
  }

  if (comment.user_id !== user.id && user.role !== 'admin') {
    throw new HttpError(403, 'You do not have permission to delete this comment')
  }

  await deleteCommentRecord(id)
  res.status(204).send()
}
