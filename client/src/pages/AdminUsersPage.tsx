import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../auth/context'
import { Pagination } from '../components/Pagination'
import { api, getErrorMessage } from '../lib/api'
import { formatDate } from '../lib/format'
import { DEFAULT_DESCRIPTION, SITE_NAME, usePageMeta } from '../lib/seo'
import type { AdminUser, PaginationMeta, UserRole } from '../types'

const PAGE_SIZE = 20
const ROLES: UserRole[] = ['admin', 'member', 'viewer']

export function AdminUsersPage() {
  const { user: currentUser } = useAuth()

  const [users, setUsers] = useState<AdminUser[]>([])
  const [meta, setMeta] = useState<PaginationMeta | null>(null)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roleDrafts, setRoleDrafts] = useState<Record<string, UserRole>>({})
  const [resetUserId, setResetUserId] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    let cancelled = false

    api
      .listUsers({ page, limit: PAGE_SIZE, q: query || undefined })
      .then((result) => {
        if (!cancelled) {
          setUsers(result.data)
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
  }, [page, query, reloadKey])

  usePageMeta({
    title: `Users — ${SITE_NAME}`,
    description: DEFAULT_DESCRIPTION,
    canonicalPath: '/admin/users',
    noIndex: true,
  })

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setQuery(searchInput.trim())
    setPage(1)
    setReloadKey((current) => current + 1)
    setLoading(true)
    setError(null)
    setResetUserId(null)
  }

  function goToPage(nextPage: number) {
    setPage(nextPage)
    setLoading(true)
    setError(null)
    setResetUserId(null)
  }

  async function handleRoleSave(user: AdminUser) {
    const role = roleDrafts[user.id] ?? user.role

    if (role === user.role) {
      return
    }

    setBusy(true)
    setError(null)

    try {
      const updated = await api.updateUserRole(user.id, role)
      setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setRoleDrafts((current) => ({ ...current, [user.id]: updated.role }))
    } catch (roleError) {
      setError(getErrorMessage(roleError))
    } finally {
      setBusy(false)
    }
  }

  async function handleResetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!resetUserId) {
      return
    }

    setBusy(true)
    setError(null)

    try {
      const updated = await api.resetUserPassword(resetUserId, password, confirmPassword)
      setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setResetUserId(null)
      setPassword('')
      setConfirmPassword('')
    } catch (resetError) {
      setError(getErrorMessage(resetError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Users</h1>
          <p className="muted">
            Change roles or reset passwords. Affected users must sign in again; their current
            sessions are revoked.
          </p>
        </div>
      </section>

      <form className="filters" role="search" onSubmit={handleSearch}>
        <label>
          <span>Search users</span>
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Username or email"
            maxLength={200}
          />
        </label>
        <button type="submit" className="button button-small" disabled={busy}>
          Search
        </button>
        {query && (
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setSearchInput('')
              setQuery('')
              setPage(1)
              setReloadKey((current) => current + 1)
              setLoading(true)
            }}
          >
            Clear search
          </button>
        )}
      </form>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="page-status" role="status">
          Loading users…
        </p>
      ) : users.length === 0 ? (
        <div className="empty-state">
          <h2>No users found</h2>
          <p className="muted">Try a different search term.</p>
        </div>
      ) : (
        <ul className="my-post-list">
          {users.map((user) => {
            const isSelf = user.id === currentUser?.id
            const role = roleDrafts[user.id] ?? user.role

            return (
              <li className="my-post" key={user.id}>
                <div className="my-post-main">
                  <strong>{user.username}</strong>
                  <span className="muted">{user.email}</span>
                  <span className="muted">Joined {formatDate(user.created_at)}</span>
                </div>

                <div className="user-actions">
                  <label>
                    <span>Role</span>
                    <select
                      aria-label={`Role for ${user.username}`}
                      value={role}
                      disabled={isSelf || busy}
                      onChange={(event) =>
                        setRoleDrafts((current) => ({
                          ...current,
                          [user.id]: event.target.value as UserRole,
                        }))
                      }
                    >
                      {ROLES.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="button button-secondary button-small"
                    disabled={isSelf || busy || role === user.role}
                    onClick={() => handleRoleSave(user)}
                  >
                    Save role
                  </button>
                  <button
                    type="button"
                    className="button button-danger button-small"
                    disabled={isSelf || busy}
                    onClick={() => {
                      setResetUserId(user.id)
                      setPassword('')
                      setConfirmPassword('')
                      setError(null)
                    }}
                  >
                    Reset password
                  </button>
                  {isSelf && <span className="muted">Your account</span>}
                </div>

                {resetUserId === user.id && (
                  <form className="user-reset-form" onSubmit={handleResetSubmit}>
                    <label>
                      <span>New password</span>
                      <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        minLength={8}
                        maxLength={72}
                        autoComplete="new-password"
                        required
                      />
                    </label>
                    <label>
                      <span>Confirm password</span>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        minLength={8}
                        maxLength={72}
                        autoComplete="new-password"
                        required
                      />
                    </label>
                    <div className="actions">
                      <button type="submit" className="button button-small" disabled={busy}>
                        Reset password
                      </button>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => setResetUserId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {meta && (
        <Pagination
          page={page}
          totalPages={meta.totalPages}
          onChange={goToPage}
          disabled={loading || busy}
        />
      )}
    </div>
  )
}
