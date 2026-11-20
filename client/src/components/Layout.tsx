import type { FormEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/context'

const currentYear = new Date().getFullYear()

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const urlQuery = searchParams.get('q') ?? ''

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = String(new FormData(event.currentTarget).get('q') ?? '').trim()
    const next = new URLSearchParams(searchParams)

    if (query) {
      next.set('q', query)
    } else {
      next.delete('q')
    }

    next.delete('page')
    navigate(`/${next.size > 0 ? `?${next.toString()}` : ''}`)
  }

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand">
            Ink<span>well</span>
          </Link>

          <nav className="main-nav" aria-label="Main">
            <NavLink to="/" end>
              Home
            </NavLink>
            {user && <NavLink to="/my-posts">My posts</NavLink>}
            {user && <NavLink to="/write">Write</NavLink>}
            {user?.role === 'admin' && (
              <>
                <NavLink to="/admin/moderation">Moderation</NavLink>
                <NavLink to="/admin/taxonomy">Taxonomy</NavLink>
              </>
            )}
          </nav>

          <form className="search-form" role="search" onSubmit={handleSearch}>
            <label className="sr-only" htmlFor="post-search">
              Search posts
            </label>
            <input
              key={urlQuery}
              id="post-search"
              type="search"
              name="q"
              placeholder="Search posts"
              defaultValue={urlQuery}
            />
            <button type="submit" className="button button-small">
              Search
            </button>
          </form>

          <div className="auth-actions">
            {user ? (
              <>
                <span className="user-chip">{user.username}</span>
                <button type="button" className="link-button" onClick={handleLogout}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login">Log in</NavLink>
                <NavLink to="/register" className="button button-small">
                  Sign up
                </NavLink>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main-content" className="container main-content" tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container footer-main">
          <div className="footer-brand">
            <Link to="/" className="brand">
              Ink<span>well</span>
            </Link>
            <p>A quiet corner for thoughtful writing.</p>
          </div>

          <nav className="footer-nav" aria-label="Footer">
            <Link to="/">Home</Link>
            {user && <Link to="/write">Write</Link>}
            <a href="/rss.xml">RSS</a>
            <a
              href="https://github.com/thuantran281/blog-application"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </nav>
        </div>

        <div className="container footer-bottom">
          <span>© {currentYear} Inkwell</span>
          <a href="https://github.com/thuantran281" target="_blank" rel="noreferrer">
            Built by @thuantran281
          </a>
        </div>
      </footer>
    </div>
  )
}
