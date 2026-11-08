import pool from '../config/db.js'
import { isUniqueViolation } from '../utils/db.js'
import { slugify } from '../utils/slug.js'

const COLUMNS = 'id, name, slug, created_at'

export interface Tag {
  id: string
  name: string
  slug: string
  created_at: Date
}

export class TagConflictError extends Error {
  constructor(message = 'A tag with that name already exists') {
    super(message)
    this.name = 'TagConflictError'
  }
}

export async function listTags(): Promise<Tag[]> {
  const result = await pool.query<Tag>(`SELECT ${COLUMNS} FROM tags ORDER BY name`)

  return result.rows
}

export async function findTagBySlug(slug: string): Promise<Tag | null> {
  const result = await pool.query<Tag>(`SELECT ${COLUMNS} FROM tags WHERE slug = $1 LIMIT 1`, [
    slug,
  ])

  return result.rows[0] ?? null
}

export async function createTag(name: string): Promise<Tag> {
  const slug = slugify(name) || 'tag'

  try {
    const result = await pool.query<Tag>(
      `INSERT INTO tags (name, slug)
       VALUES ($1, $2)
       RETURNING ${COLUMNS}`,
      [name, slug],
    )

    const tag = result.rows[0]

    if (!tag) {
      throw new Error('Insert did not return a tag')
    }

    return tag
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new TagConflictError()
    }

    throw err
  }
}

export async function updateTag(id: string, name: string): Promise<Tag | null> {
  const slug = slugify(name) || 'tag'

  try {
    const result = await pool.query<Tag>(
      `UPDATE tags
       SET name = $1, slug = $2
       WHERE id = $3
       RETURNING ${COLUMNS}`,
      [name, slug, id],
    )

    return result.rows[0] ?? null
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new TagConflictError()
    }

    throw err
  }
}

export async function deleteTag(id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM tags WHERE id = $1 RETURNING id', [id])

  return result.rowCount === 1
}
