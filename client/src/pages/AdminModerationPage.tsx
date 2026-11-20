import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pagination } from '../components/Pagination'
import { api, getErrorMessage } from '../lib/api'
import { formatDate } from '../lib/format'
import { DEFAULT_DESCRIPTION, SITE_NAME, usePageMeta } from '../lib/seo'
import type { PaginationMeta, ReportedComment } from '../types'

const PAGE_SIZE = 20

export function AdminModerationPage() {
  const [reports, setReports] = useState<ReportedComment[]>([])
  const [meta, setMeta] = useState<PaginationMeta | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    api
      .listReports({ page, limit: PAGE_SIZE })
      .then((result) => {
        if (!cancelled) {
          setReports(result.data)
          setMeta(result.meta)
          setError(null)
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
  }, [page])

  usePageMeta({
    title: `Reported comments — ${SITE_NAME}`,
    description: DEFAULT_DESCRIPTION,
    canonicalPath: '/admin/moderation',
    noIndex: true,
  })

  async function handleDelete(report: ReportedComment) {
    if (!window.confirm('Delete this reported comment?')) {
      return
    }

    setError(null)

    try {
      await api.deleteComment(report.comment_id)
      setReports((current) => current.filter((item) => item.comment_id !== report.comment_id))
      setMeta((current) => {
        if (!current) {
          return current
        }

        const total = Math.max(0, current.total - 1)
        return {
          ...current,
          total,
          totalPages: Math.ceil(total / current.limit),
        }
      })
    } catch (deleteError) {
      setError(getErrorMessage(deleteError))
    }
  }

  return (
    <div className="stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Reported comments</h1>
          <p className="muted">
            Review comments flagged by readers. Deleting a comment also clears its reports.
          </p>
        </div>
      </section>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="page-status" role="status">
          Loading reports…
        </p>
      ) : reports.length === 0 ? (
        <div className="empty-state">
          <h2>No reported comments</h2>
          <p className="muted">Reader reports will appear here.</p>
        </div>
      ) : (
        <ul className="comment-list">
          {reports.map((report) => (
            <li className="comment" key={report.comment_id}>
              <div className="comment-head">
                <strong>{report.author_name ?? 'Anonymous'}</strong>
                <span>
                  {report.report_count} {report.report_count === 1 ? 'report' : 'reports'}
                </span>
                <time dateTime={report.last_reported_at}>
                  Last reported {formatDate(report.last_reported_at)}
                </time>
              </div>
              <p>{report.content}</p>
              <p className="muted">
                On <Link to={`/posts/${report.post_slug}`}>{report.post_title}</Link> · posted{' '}
                {formatDate(report.created_at)}
              </p>
              <div className="actions">
                <Link className="button button-secondary button-small" to={`/posts/${report.post_slug}`}>
                  View post
                </Link>
                <button
                  type="button"
                  className="button button-danger button-small"
                  onClick={() => handleDelete(report)}
                >
                  Delete comment
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
          onChange={setPage}
          disabled={loading}
        />
      )}
    </div>
  )
}
