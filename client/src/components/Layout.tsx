import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/context'

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <div className="app-shell">
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
            {user?.role === 'admin' && <NavLink to="/admin/taxonomy">Taxonomy</NavLink>}
          </nav>

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

      <main className="container main-content">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container">Built with React, Vite, and the Blog API.</div>
      </footer>
    </div>
  )
}
