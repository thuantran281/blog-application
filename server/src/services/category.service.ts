import pool from '../config/db.js'
import { isUniqueViolation } from '../utils/db.js'
import { slugify } from '../utils/slug.js'

const COLUMNS = 'id, name, slug, created_at'

export interface Category {
  id: string
  name: string
  slug: string
  created_at: Date
}

export class CategoryConflictError extends Error {
  constructor(message = 'A category with that name already exists') {
    super(message)
    this.name = 'CategoryConflictError'
  }
}

export async function listCategories(): Promise<Category[]> {
  const result = await pool.query<Category>(`SELECT ${COLUMNS} FROM categories ORDER BY name`)

  return result.rows
}

export async function findCategoryBySlug(slug: string): Promise<Category | null> {
  const result = await pool.query<Category>(
    `SELECT ${COLUMNS} FROM categories WHERE slug = $1 LIMIT 1`,
    [slug],
  )

  return result.rows[0] ?? null
}

export async function createCategory(name: string): Promise<Category> {
  const slug = slugify(name) || 'category'

  try {
    const result = await pool.query<Category>(
      `INSERT INTO categories (name, slug)
       VALUES ($1, $2)
       RETURNING ${COLUMNS}`,
      [name, slug],
    )

    const category = result.rows[0]

    if (!category) {
      throw new Error('Insert did not return a category')
    }

    return category
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new CategoryConflictError()
    }

    throw err
  }
}

export async function updateCategory(id: string, name: string): Promise<Category | null> {
  const slug = slugify(name) || 'category'

  try {
    const result = await pool.query<Category>(
      `UPDATE categories
       SET name = $1, slug = $2
       WHERE id = $3
       RETURNING ${COLUMNS}`,
      [name, slug, id],
    )

    return result.rows[0] ?? null
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new CategoryConflictError()
    }

    throw err
  }
}

export async function deleteCategory(id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING id', [id])

  return result.rowCount === 1
}
