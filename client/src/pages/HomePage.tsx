import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { Pagination } from '../components/Pagination'
import { api, getErrorMessage } from '../lib/api'
import { formatDate } from '../lib/format'
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, usePageMeta } from '../lib/seo'
import type { Category, PaginationMeta, PostSummary, Tag } from '../types'

const PAGE_SIZE = 9

export function HomePage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const pageParam = Number(searchParams.get('page') ?? '1')
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1
  const category = searchParams.get('category') ?? ''
  const tag = searchParams.get('tag') ?? ''

  const [posts, setPosts] = useState<PostSummary[]>([])
  const [meta, setMeta] = useState<PaginationMeta | null>(null)
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

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    api
      .listPosts({
        page,
        limit: PAGE_SIZE,
        category: category || undefined,
        tag: tag || undefined,
      })
      .then((result) => {
        if (!cancelled) {
          setPosts(result.data)
          setMeta(result.meta)
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
  }, [page, category, tag])

  usePageMeta({
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    canonicalPath: '/',
  })

  function setFilter(key: 'category' | 'tag', value: string) {
    const next = new URLSearchParams(searchParams)

    if (value) {
      next.set(key, value)
    } else {
      next.delete(key)
    }

    next.delete('page')
    setLoading(true)
    setError(null)
    setSearchParams(next, { replace: true })
  }

  function goToPage(nextPage: number) {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(nextPage))
    setLoading(true)
    setError(null)
    setSearchParams(next, { replace: true })
  }

  function clearFilters() {
    setLoading(true)
    setError(null)
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  return (
    <div className="stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">The latest</p>
          <h1>Stories and ideas</h1>
          <p className="muted">Read what the community has been publishing.</p>
        </div>
        <Link className="button" to={user ? '/write' : '/login'}>
          {user ? 'Write a post' : 'Start writing'}
        </Link>
      </section>

      <section className="filters" aria-label="Filters">
        <label>
          <span>Category</span>
          <select value={category} onChange={(event) => setFilter('category', event.target.value)}>
            <option value="">All categories</option>
            {categories.map((item) => (
              <option key={item.id} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Tag</span>
          <select value={tag} onChange={(event) => setFilter('tag', event.target.value)}>
            <option value="">All tags</option>
            {tags.map((item) => (
              <option key={item.id} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        {(category || tag) && (
          <button type="button" className="link-button" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </section>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="page-status">Loading posts…</p>
      ) : posts.length === 0 ? (
        <div className="empty-state">
          <h2>No posts yet</h2>
          <p className="muted">Try a different filter, or be the first to publish.</p>
        </div>
      ) : (
        <div className="post-grid">
          {posts.map((post) => (
            <article className="post-card" key={post.id}>
              <p className="post-card-meta">
                <time dateTime={post.published_at ?? post.created_at}>
                  {formatDate(post.published_at ?? post.created_at)}
                </time>
                <span> · By {post.author_name ?? 'Anonymous'}</span>
              </p>
              <h2>
                <Link to={`/posts/${post.slug}`}>{post.title}</Link>
              </h2>
              {post.excerpt && <p className="muted">{post.excerpt}</p>}
            </article>
          ))}
        </div>
      )}

      {meta && (
        <Pagination
          page={page}
          totalPages={meta.totalPages}
          onChange={goToPage}
          disabled={loading}
        />
      )}
    </div>
  )
}
