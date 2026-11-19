import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main id="main-content" className="container main-content" tabIndex={-1}>
          <div className="empty-state" role="alert">
            <h1>Something went wrong</h1>
            <p className="muted">Reload the page, or go back to the home page.</p>
            <div className="actions">
              <button type="button" className="button" onClick={() => window.location.reload()}>
                Reload
              </button>
              <a className="button button-secondary" href="/">
                Go home
              </a>
            </div>
          </div>
        </main>
      )
    }

    return this.props.children
  }
}
