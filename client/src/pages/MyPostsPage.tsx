import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pagination } from '../components/Pagination'
import { api, getErrorMessage } from '../lib/api'
import { formatDate } from '../lib/format'
import type { PaginationMeta, PostStatus, PostSummary } from '../types'

const PAGE_SIZE = 10

export function MyPostsPage() {
  const [status, setStatus] = useState<'all' | PostStatus>('all')
  const [page, setPage] = useState(1)
  const [posts, setPosts] = useState<PostSummary[]>([])
  const [meta, setMeta] = useState<PaginationMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false

    api
      .listMyPosts({
        page,
        limit: PAGE_SIZE,
        status: status === 'all' ? undefined : status,
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
  }, [page, status, version])

  async function handleDelete(post: PostSummary) {
    if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`)) {
      return
    }

    setError(null)

    try {
      await api.deletePost(post.id)
      setLoading(true)
      setVersion((current) => current + 1)
    } catch (deleteError) {
      setError(getErrorMessage(deleteError))
    }
  }

  function changePage(nextPage: number) {
    setLoading(true)
    setError(null)
    setPage(nextPage)
  }

  return (
    <div className="stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Your workspace</p>
          <h1>My posts</h1>
          <p className="muted">Manage drafts and published stories.</p>
        </div>
        <Link className="button" to="/write">
          New post
        </Link>
      </section>

      <section className="filters" aria-label="Filters">
        <label>
          <span>Status</span>
          <select
            value={status}
            onChange={(event) => {
              setLoading(true)
              setError(null)
              setStatus(event.target.value as 'all' | PostStatus)
              setPage(1)
            }}
          >
            <option value="all">All</option>
            <option value="draft">Drafts</option>
            <option value="published">Published</option>
          </select>
        </label>
      </section>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="page-status">Loading posts…</p>
      ) : posts.length === 0 ? (
        <div className="empty-state">
          <h2>Nothing here yet</h2>
          <p className="muted">Create your first post to see it here.</p>
        </div>
      ) : (
        <ul className="my-post-list">
          {posts.map((post) => (
            <li className="my-post" key={post.id}>
              <div className="my-post-main">
                <div className="my-post-title">
                  <Link to={`/posts/${post.slug}`}>{post.title}</Link>
                  <span className={`badge badge-${post.status}`}>
                    {post.status === 'draft' ? 'Draft' : 'Published'}
                  </span>
                </div>
                <p className="muted">
                  Updated {formatDate(post.updated_at)}
                  {post.published_at ? ` · Published ${formatDate(post.published_at)}` : ''}
                  {` · By ${post.author_name ?? 'Anonymous'}`}
                </p>
              </div>
              <div className="actions">
                <Link
                  className="button button-small button-secondary"
                  to={`/posts/${post.slug}/edit`}
                >
                  Edit
                </Link>
                <button
                  type="button"
                  className="button button-small button-danger"
                  onClick={() => handleDelete(post)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {meta && (
        <Pagination
          page={page}
          totalPages={meta.totalPages}
          onChange={changePage}
          disabled={loading}
        />
      )}
    </div>
  )
}
