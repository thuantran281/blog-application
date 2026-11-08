import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api, getErrorMessage } from '../lib/api'
import type { Category, Tag } from '../types'

interface TaxonomyItem {
  id: string
  name: string
  slug: string
}

interface TaxonomyManagerProps<T extends TaxonomyItem> {
  kind: 'categories' | 'tags'
  title: string
  items: T[]
  onCreate: (name: string) => Promise<T>
  onUpdate: (id: string, name: string) => Promise<T>
  onDelete: (id: string) => Promise<void>
  onItemsChange: (items: T[]) => void
}

function sortByName<T extends TaxonomyItem>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name))
}

function TaxonomyManager<T extends TaxonomyItem>({
  kind,
  title,
  items,
  onCreate,
  onUpdate,
  onDelete,
  onItemsChange,
}: TaxonomyManagerProps<T>) {
  const label = kind === 'categories' ? 'category' : 'tag'

  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const name = newName.trim()

    if (!name) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      const created = await onCreate(name)
      onItemsChange(sortByName([...items, created]))
      setNewName('')
    } catch (createError) {
      setError(getErrorMessage(createError))
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault()

    const name = editingName.trim()

    if (!name) {
      setError(`Enter a ${label} name.`)
      return
    }

    setSaving(true)
    setError(null)

    try {
      const updated = await onUpdate(id, name)
      onItemsChange(sortByName(items.map((item) => (item.id === updated.id ? updated : item))))
      setEditingId(null)
      setEditingName('')
    } catch (updateError) {
      setError(getErrorMessage(updateError))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item: T) {
    if (!window.confirm(`Delete the ${label} “${item.name}”?`)) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      await onDelete(item.id)
      onItemsChange(items.filter((current) => current.id !== item.id))

      if (editingId === item.id) {
        setEditingId(null)
        setEditingName('')
      }
    } catch (deleteError) {
      setError(getErrorMessage(deleteError))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="taxonomy-panel">
      <div className="section-heading">
        <h2>{title}</h2>
        <span className="muted">{items.length}</span>
      </div>

      {error && <p className="error">{error}</p>}

      <form className="taxonomy-form" onSubmit={handleCreate}>
        <input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder={`New ${label} name`}
          maxLength={100}
          required
        />
        <button type="submit" className="button" disabled={saving}>
          {saving ? 'Saving…' : 'Add'}
        </button>
      </form>

      {items.length === 0 ? (
        <p className="muted">No {label} entries yet.</p>
      ) : (
        <ul className="my-post-list">
          {items.map((item) => (
            <li className="my-post" key={item.id}>
              <div className="my-post-main">
                {editingId === item.id ? (
                  <form className="taxonomy-form" onSubmit={(event) => handleUpdate(event, item.id)}>
                    <input
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      maxLength={100}
                      aria-label={`${label} name`}
                      autoFocus
                      required
                    />
                    <button type="submit" className="button button-small" disabled={saving}>
                      Save
                    </button>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => {
                        setEditingId(null)
                        setEditingName('')
                      }}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <div className="my-post-title">
                    <strong>{item.name}</strong>
                    <span className="muted">{item.slug}</span>
                  </div>
                )}
              </div>

              {editingId !== item.id && (
                <div className="actions">
                  <button
                    type="button"
                    className="button button-small button-secondary"
                    onClick={() => {
                      setEditingId(item.id)
                      setEditingName(item.name)
                      setError(null)
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="button button-small button-danger"
                    onClick={() => handleDelete(item)}
                    disabled={saving}
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function AdminTaxonomyPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    Promise.all([api.listCategories(), api.listTags()])
      .then(([categoryList, tagList]) => {
        if (!cancelled) {
          setCategories(categoryList)
          setTags(tagList)
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(getErrorMessage(loadError))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Taxonomy</h1>
          <p className="muted">
            Manage the categories and tags that writers can attach to their posts.
          </p>
        </div>
      </section>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="page-status">Loading taxonomy…</p>
      ) : (
        <div className="taxonomy-grid">
          <TaxonomyManager
            kind="categories"
            title="Categories"
            items={categories}
            onCreate={api.createCategory}
            onUpdate={api.updateCategory}
            onDelete={api.deleteCategory}
            onItemsChange={setCategories}
          />

          <TaxonomyManager
            kind="tags"
            title="Tags"
            items={tags}
            onCreate={api.createTag}
            onUpdate={api.updateTag}
            onDelete={api.deleteTag}
            onItemsChange={setTags}
          />
        </div>
      )}
    </div>
  )
}
