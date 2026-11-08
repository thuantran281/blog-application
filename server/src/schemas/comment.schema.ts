import { z } from 'zod'

export const listCommentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const createCommentSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  guestName: z.string().trim().min(1).max(100).optional(),
})

export const commentIdParamSchema = z.object({
  id: z.uuid(),
})

export type CreateCommentInput = z.infer<typeof createCommentSchema>
