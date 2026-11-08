import type { Request, Response } from 'express'
import { HttpError } from '../middleware/error.js'
import {
  createTaxonomySchema,
  taxonomyIdParamSchema,
  taxonomySlugParamSchema,
  updateTaxonomySchema,
} from '../schemas/taxonomy.schema.js'
import {
  createTag as createTagRecord,
  deleteTag as deleteTagRecord,
  findTagBySlug,
  listTags as listTagRecords,
  TagConflictError,
  updateTag as updateTagRecord,
} from '../services/tag.service.js'

export async function listTags(_req: Request, res: Response) {
  const tags = await listTagRecords()
  res.json({ data: tags })
}

export async function getTag(req: Request, res: Response) {
  const { slug } = taxonomySlugParamSchema.parse(req.params)
  const tag = await findTagBySlug(slug)

  if (!tag) {
    throw new HttpError(404, 'Tag not found')
  }

  res.json({ data: tag })
}

export async function createTag(req: Request, res: Response) {
  const input = createTaxonomySchema.parse(req.body)

  try {
    const tag = await createTagRecord(input.name)
    res.status(201).location(`/api/tags/${tag.slug}`).json({ data: tag })
  } catch (err) {
    if (err instanceof TagConflictError) {
      throw new HttpError(409, err.message)
    }

    throw err
  }
}

export async function updateTag(req: Request, res: Response) {
  const { id } = taxonomyIdParamSchema.parse(req.params)
  const input = updateTaxonomySchema.parse(req.body)

  try {
    const tag = await updateTagRecord(id, input.name ?? '')
    if (!tag) {
      throw new HttpError(404, 'Tag not found')
    }

    res.json({ data: tag })
  } catch (err) {
    if (err instanceof TagConflictError) {
      throw new HttpError(409, err.message)
    }

    throw err
  }
}

export async function deleteTag(req: Request, res: Response) {
  const { id } = taxonomyIdParamSchema.parse(req.params)
  const deleted = await deleteTagRecord(id)

  if (!deleted) {
    throw new HttpError(404, 'Tag not found')
  }

  res.status(204).send()
}
