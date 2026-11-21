import type { Request, Response } from 'express'
import { getAuthUser } from '../middleware/auth.js'
import { HttpError } from '../middleware/error.js'
import {
  listUsersQuerySchema,
  resetPasswordSchema,
  updateRoleSchema,
  userIdParamSchema,
} from '../schemas/admin.schema.js'
import {
  listUsers,
  resetUserPassword,
  SelfModificationError,
  updateUserRole,
} from '../services/admin.service.js'

export async function listUsersHandler(req: Request, res: Response) {
  const { page, limit, q } = listUsersQuerySchema.parse(req.query)
  res.json(await listUsers({ page, limit, q }))
}

export async function updateRoleHandler(req: Request, res: Response) {
  const actor = getAuthUser(req)
  const { id } = userIdParamSchema.parse(req.params)
  const { role } = updateRoleSchema.parse(req.body)

  let user
  try {
    user = await updateUserRole(id, role, actor.id)
  } catch (err) {
    if (err instanceof SelfModificationError) {
      throw new HttpError(400, err.message)
    }

    throw err
  }

  if (!user) {
    throw new HttpError(404, 'User not found')
  }

  res.json({ data: user })
}

export async function resetPasswordHandler(req: Request, res: Response) {
  const actor = getAuthUser(req)
  const { id } = userIdParamSchema.parse(req.params)
  const { password } = resetPasswordSchema.parse(req.body)

  let user
  try {
    user = await resetUserPassword(id, password, actor.id)
  } catch (err) {
    if (err instanceof SelfModificationError) {
      throw new HttpError(400, err.message)
    }

    throw err
  }

  if (!user) {
    throw new HttpError(404, 'User not found')
  }

  res.json({ data: user })
}
