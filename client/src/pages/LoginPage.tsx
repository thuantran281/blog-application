import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { getErrorMessage } from '../lib/api'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const redirectTo =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setSubmitting(true)
    setError(null)

    try {
      await login(email, password)
      navigate(redirectTo, { replace: true })
    } catch (loginError) {
      setError(getErrorMessage(loginError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-card">
        <h1>Welcome back</h1>
        <p className="muted">Log in to write, edit, and comment.</p>

        {error && <p className="error">{error}</p>}

        <form className="stack-sm" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              maxLength={254}
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          <button type="submit" className="button" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p className="muted">
          New here? <Link to="/register">Create an account</Link>.
        </p>
      </section>
    </div>
  )
}
