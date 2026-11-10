import { lazy, Suspense, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { api, getErrorMessage } from '../lib/api'
import type { Category, PostStatus, Tag } from '../types'

const RichTextEditor = lazy(() =>
  import('../components/RichTextEditor').then((module) => ({ default: module.RichTextEditor })),
)

interface EditorPageProps {
  mode: 'create' | 'edit'
}

type BylineMode = 'username' | 'anonymous' | 'custom'

export function EditorPage({ mode }: EditorPageProps) {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [postId, setPostId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [status, setStatus] = useState<PostStatus>('draft')
  const [categoryId, setCategoryId] = useState('')
  const [tagIds, setTagIds] = useState<string[]>([])
  const [bylineMode, setBylineMode] = useState<BylineMode>('username')
  const [customName, setCustomName] = useState('')

  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])

  const [loadedSlug, setLoadedSlug] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loading = mode === 'edit' && loadedSlug !== slug

  const missingSlug = mode === 'edit' && !slug

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

    if (mode === 'edit') {
      if (!slug) {
        return () => {
          cancelled = true
        }
      }

      api
        .getPost(slug)
        .then((post) => {
          if (cancelled) {
            return
          }

          setPostId(post.id)
          setTitle(post.title)
          setContent(post.content)
          setExcerpt(post.excerpt ?? '')
          setStatus(post.status)
          setCategoryId(post.category_id ?? '')
          setTagIds(post.tags.map((tag) => tag.id))

          if (user && post.author_name === user.username) {
            setBylineMode('username')
          } else if (post.author_name === null) {
            setBylineMode('anonymous')
          } else {
            setBylineMode('custom')
            setCustomName(post.author_name)
          }

          setLoadedSlug(slug)
        })
        .catch((loadError: unknown) => {
          if (!cancelled) {
            setError(getErrorMessage(loadError))
            setLoadedSlug(slug)
          }
        })
    }

    return () => {
      cancelled = true
    }
  }, [mode, slug, user])

  function toggleTag(tagId: string) {
    setTagIds((current) =>
      current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId],
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!title.trim() || !content.trim()) {
      setError('Title and content are required.')
      return
    }

    const displayName =
      bylineMode === 'anonymous'
        ? null
        : bylineMode === 'custom'
          ? customName.trim()
          : (user?.username ?? null)

    if (bylineMode === 'custom' && !displayName) {
      setError('Enter a display name, or choose a different byline option.')
      return
    }

    setSaving(true)
    setError(null)

    const trimmedExcerpt = excerpt.trim()

    try {
      const input = {
        title: title.trim(),
        content,
        status,
        categoryId: categoryId || null,
        tagIds,
        displayName,
        ...(trimmedExcerpt ? { excerpt: trimmedExcerpt } : {}),
      }

      if (mode === 'edit') {
        if (!postId) {
          throw new Error('Post has not loaded yet')
        }

        const updated = await api.updatePost(postId, {
          ...input,
          excerpt: trimmedExcerpt || null,
        })

        navigate(`/posts/${updated.slug}`)
      } else {
        const created = await api.createPost(input)
        navigate(`/posts/${created.slug}`)
      }
    } catch (saveError) {
      setError(getErrorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  if (missingSlug) {
    return (
      <div className="empty-state">
        <h2>Post not found</h2>
        <p className="muted">This edit link is missing a post slug.</p>
        <Link className="button" to="/my-posts">
          Back to my posts
        </Link>
      </div>
    )
  }

  if (loading) {
    return <p className="page-status">Loading post…</p>
  }

  return (
    <div className="stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{mode === 'edit' ? 'Edit post' : 'New post'}</p>
          <h1>{mode === 'edit' ? 'Shape your story' : 'Write something new'}</h1>
        </div>
        <Link
          className="button button-secondary"
          to={mode === 'edit' && slug ? `/posts/${slug}` : '/'}
        >
          Cancel
        </Link>
      </section>

      {error && <p className="error">{error}</p>}

      <form className="editor-form" onSubmit={handleSubmit}>
        <label>
          <span>Title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            required
          />
        </label>

        <label>
          <span>Excerpt</span>
          <textarea
            value={excerpt}
            onChange={(event) => setExcerpt(event.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Optional short summary shown on the home page."
          />
        </label>

        <div className="editor-field">
          <span>Content</span>
          <Suspense fallback={<p className="muted">Loading editor…</p>}>
            <RichTextEditor key={postId ?? 'new'} markdown={content} onChange={setContent} />
          </Suspense>
        </div>

        <div className="editor-row">
          <label>
            <span>Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as PostStatus)}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>

          <label>
            <span>Category</span>
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="editor-row">
          <label>
            <span>Publish as</span>
            <select
              value={bylineMode}
              onChange={(event) => setBylineMode(event.target.value as BylineMode)}
            >
              <option value="username">
                {user ? `My username (${user.username})` : 'My username'}
              </option>
              <option value="anonymous">Anonymous</option>
              <option value="custom">Custom name</option>
            </select>
          </label>

          {bylineMode === 'custom' && (
            <label>
              <span>Display name</span>
              <input
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
                maxLength={100}
                placeholder="Pen name"
                required
              />
            </label>
          )}
        </div>

        <fieldset className="tag-picker">
          <legend>Tags</legend>
          {tags.length === 0 ? (
            <p className="muted">No tags available yet.</p>
          ) : (
            <div className="tag-options">
              {tags.map((tag) => (
                <label key={tag.id} className="checkbox">
                  <input
                    type="checkbox"
                    checked={tagIds.includes(tag.id)}
                    onChange={() => toggleTag(tag.id)}
                  />
                  <span>{tag.name}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <div className="actions">
          <button type="submit" className="button" disabled={saving}>
            {saving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Create post'}
          </button>
        </div>
      </form>
    </div>
  )
}
