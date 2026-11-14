import { Link } from 'react-router-dom'
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, usePageMeta } from '../lib/seo'

export function NotFoundPage() {
  usePageMeta({
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    canonicalPath: '/',
    noIndex: true,
  })

  return (
    <div className="empty-state">
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <p className="muted">The page you are looking for does not exist.</p>
      <Link className="button" to="/">
        Back home
      </Link>
    </div>
  )
}
