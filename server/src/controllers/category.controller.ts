import type { Request, Response } from 'express'
import { HttpError } from '../middleware/error.js'
import {
  createTaxonomySchema,
  taxonomyIdParamSchema,
  taxonomySlugParamSchema,
  updateTaxonomySchema,
} from '../schemas/taxonomy.schema.js'
import {
  CategoryConflictError,
  createCategory as createCategoryRecord,
  deleteCategory as deleteCategoryRecord,
  findCategoryBySlug,
  listCategories as listCategoryRecords,
  updateCategory as updateCategoryRecord,
} from '../services/category.service.js'

export async function listCategories(_req: Request, res: Response) {
  const categories = await listCategoryRecords()
  res.json({ data: categories })
}

export async function getCategory(req: Request, res: Response) {
  const { slug } = taxonomySlugParamSchema.parse(req.params)
  const category = await findCategoryBySlug(slug)

  if (!category) {
    throw new HttpError(404, 'Category not found')
  }

  res.json({ data: category })
}

export async function createCategory(req: Request, res: Response) {
  const input = createTaxonomySchema.parse(req.body)

  try {
    const category = await createCategoryRecord(input.name)
    res.status(201).location(`/api/categories/${category.slug}`).json({ data: category })
  } catch (err) {
    if (err instanceof CategoryConflictError) {
      throw new HttpError(409, err.message)
    }

    throw err
  }
}

export async function updateCategory(req: Request, res: Response) {
  const { id } = taxonomyIdParamSchema.parse(req.params)
  const input = updateTaxonomySchema.parse(req.body)

  try {
    const category = await updateCategoryRecord(id, input.name ?? '')
    if (!category) {
      throw new HttpError(404, 'Category not found')
    }

    res.json({ data: category })
  } catch (err) {
    if (err instanceof CategoryConflictError) {
      throw new HttpError(409, err.message)
    }

    throw err
  }
}

export async function deleteCategory(req: Request, res: Response) {
  const { id } = taxonomyIdParamSchema.parse(req.params)
  const deleted = await deleteCategoryRecord(id)

  if (!deleted) {
    throw new HttpError(404, 'Category not found')
  }

  res.status(204).send()
}
