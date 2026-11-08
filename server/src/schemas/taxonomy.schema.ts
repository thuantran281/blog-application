import { z } from 'zod'

export const createTaxonomySchema = z.object({
  name: z.string().trim().min(1).max(100),
})

export const updateTaxonomySchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: 'At least one field is required',
  })

export const taxonomyIdParamSchema = z.object({
  id: z.uuid(),
})

export const taxonomySlugParamSchema = z.object({
  slug: z.string().min(1),
})

export type CreateTaxonomyInput = z.infer<typeof createTaxonomySchema>
export type UpdateTaxonomyInput = z.infer<typeof updateTaxonomySchema>
