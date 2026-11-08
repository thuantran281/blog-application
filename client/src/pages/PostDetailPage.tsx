import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { api, getErrorMessage } from '../lib/api'
import { formatDate } from '../lib/format'
import type { Comment, Post } from '../types'

export function PostDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentTotal, setCommentTotal] = useState(0)
  const [postLoading, setPostLoading] = useState(true)
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [commentContent, setCommentContent] = useState('')
  const [guestName, setGuestName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isPublished = post?.status === 'published'
  const missingSlug = !slug

  useEffect(() => {
    if (!slug) {
      return
    }

    let cancelled = false

    api
      .getPost(slug)
      .then((loadedPost) => {
        if (!cancelled) {
          setPost(loadedPost)

          if (loadedPost.status === 'published') {
            setCommentsLoading(true)
          }
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(getErrorMessage(loadError))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPostLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    if (!slug || !isPublished) {
      return
    }

    let cancelled = false

    api
      .listComments(slug, { page: 1, limit: 100 })
      .then((result) => {
        if (!cancelled) {
          setComments(result.data)
          setCommentTotal(result.meta.total)
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setActionError(getErrorMessage(loadError))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCommentsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [slug, isPublished])

  async function handleCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!slug) {
      return
    }

    const content = commentContent.trim()

    if (!content) {
      setActionError('Comment cannot be empty.')
      return
    }

    if (!user && !guestName.trim()) {
      setActionError('Please add your name before commenting.')
      return
    }

    setSubmitting(true)
    setActionError(null)

    try {
      const created = await api.createComment(slug, {
        content,
        ...(user ? {} : { guestName: guestName.trim() }),
      })

      setComments((current) => [...current, created])
      setCommentTotal((current) => current + 1)
      setCommentContent('')
    } catch (submitError) {
      setActionError(getErrorMessage(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteComment(id: string) {
    if (!window.confirm('Delete this comment?')) {
      return
    }

    setActionError(null)

    try {
      await api.deleteComment(id)
      setComments((current) => current.filter((comment) => comment.id !== id))
      setCommentTotal((current) => Math.max(0, current - 1))
    } catch (deleteError) {
      setActionError(getErrorMessage(deleteError))
    }
  }

  async function handleDeletePost() {
    if (!post || !window.confirm('Delete this post? This cannot be undone.')) {
      return
    }

    setActionError(null)

    try {
      await api.deletePost(post.id)
      navigate('/')
    } catch (deleteError) {
      setActionError(getErrorMessage(deleteError))
    }
  }

  if (missingSlug) {
    return (
      <div className="empty-state">
        <h1>Post not found</h1>
        <p className="muted">This link is missing a post slug.</p>
        <Link className="button" to="/">
          Back to posts
        </Link>
      </div>
    )
  }

  if (postLoading) {
    return <p className="page-status">Loading post…</p>
  }

  if (error || !post) {
    return (
      <div className="empty-state">
        <h1>Post not found</h1>
        <p className="muted">{error ?? 'This post may have been removed.'}</p>
        <Link className="button" to="/">
          Back to posts
        </Link>
      </div>
    )
  }

  const canManagePost = user !== null && (user.role === 'admin' || post.author_id === user.id)
  const displayDate = post.published_at ?? post.created_at

  return (
    <div className="stack">
      <article className="post-detail">
        <div className="post-detail-top">
          <Link to="/" className="back-link">
            ← All posts
          </Link>
          {post.status === 'draft' && <span className="badge badge-draft">Draft</span>}
        </div>

        <h1>{post.title}</h1>

        <div className="post-meta">
          <time dateTime={displayDate}>{formatDate(displayDate)}</time>
          <span>By {post.author_name ?? 'Anonymous'}</span>
          {post.category && (
            <Link to={`/?category=${encodeURIComponent(post.category.slug)}`}>
              {post.category.name}
            </Link>
          )}
          {post.tags.map((tag) => (
            <Link key={tag.id} to={`/?tag=${encodeURIComponent(tag.slug)}`} className="tag">
              {tag.name}
            </Link>
          ))}
        </div>

        <div className="post-content">{post.content}</div>

        {canManagePost && (
          <div className="actions">
            <Link className="button button-secondary" to={`/posts/${post.slug}/edit`}>
              Edit
            </Link>
            <button type="button" className="button button-danger" onClick={handleDeletePost}>
              Delete
            </button>
          </div>
        )}
      </article>

      {isPublished && (
        <section className="comments">
          <div className="section-heading">
            <h2>Comments</h2>
            <span className="muted">
              {commentTotal} {commentTotal === 1 ? 'comment' : 'comments'}
            </span>
          </div>

          {actionError && <p className="error">{actionError}</p>}

          {commentsLoading ? (
            <p className="page-status">Loading comments…</p>
          ) : comments.length === 0 ? (
            <p className="muted">No comments yet. Start the conversation.</p>
          ) : (
            <ul className="comment-list">
              {comments.map((comment) => {
                const canDelete =
                  user !== null && (user.role === 'admin' || comment.user_id === user.id)

                return (
                  <li className="comment" key={comment.id}>
                    <div className="comment-head">
                      <strong>{comment.author_name}</strong>
                      <time dateTime={comment.created_at}>{formatDate(comment.created_at)}</time>
                      {canDelete && (
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => handleDeleteComment(comment.id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    <p>{comment.content}</p>
                  </li>
                )
              })}
            </ul>
          )}

          <form className="comment-form" onSubmit={handleCommentSubmit}>
            <h3>Leave a comment</h3>
            <p className="muted">
              {user ? `Commenting as ${user.username}.` : 'Commenting as a guest.'}
            </p>

            {!user && (
              <label>
                <span>Your name</span>
                <input
                  value={guestName}
                  onChange={(event) => setGuestName(event.target.value)}
                  maxLength={100}
                  required
                />
              </label>
            )}

            <label>
              <span>Comment</span>
              <textarea
                value={commentContent}
                onChange={(event) => setCommentContent(event.target.value)}
                maxLength={2000}
                rows={4}
                required
              />
            </label>

            <button type="submit" className="button" disabled={submitting}>
              {submitting ? 'Posting…' : 'Post comment'}
            </button>
          </form>
        </section>
      )}
    </div>
  )
}
