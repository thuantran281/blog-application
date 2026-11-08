import { z } from 'zod'

export const listPostsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
  category: z.string().trim().min(1).optional(),
  tag: z.string().trim().min(1).optional(),
})

export const myPostsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
  status: z.enum(['draft', 'published']).optional(),
})

export const postSlugParamSchema = z.object({
  slug: z.string().min(1),
})

export const postIdParamSchema = z.object({
  id: z.uuid(),
})

export const createPostSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().min(1),
  excerpt: z.string().trim().max(500).optional(),
  status: z.enum(['draft', 'published']).default('draft'),
  categoryId: z.uuid().nullable().optional(),
  tagIds: z.array(z.uuid()).max(20).optional(),
  displayName: z.string().trim().min(1).max(100).nullable().optional(),
})

export const updatePostSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    content: z.string().min(1).optional(),
    excerpt: z.string().trim().max(500).nullable().optional(),
    status: z.enum(['draft', 'published']).optional(),
    categoryId: z.uuid().nullable().optional(),
    tagIds: z.array(z.uuid()).max(20).optional(),
    displayName: z.string().trim().min(1).max(100).nullable().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: 'At least one field is required',
  })

export type ListPostsQuery = z.infer<typeof listPostsQuerySchema>
export type CreatePostInput = z.infer<typeof createPostSchema>
export type UpdatePostInput = z.infer<typeof updatePostSchema>
