import { z } from 'zod'

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
  q: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((value) => value || undefined),
})

export const userIdParamSchema = z.object({
  id: z.uuid(),
})

export const updateRoleSchema = z.object({
  role: z.enum(['admin', 'member', 'viewer']),
})

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8)
      .max(72)
      .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, {
        message: 'Password must be at most 72 UTF-8 bytes',
      }),
    confirmPassword: z.string(),
  })
  .refine((input) => input.password === input.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>
