interface PaginationProps {
  page: number
  totalPages: number
  onChange: (page: number) => void
  disabled?: boolean
}

export function Pagination({ page, totalPages, onChange, disabled = false }: PaginationProps) {
  if (totalPages <= 1) {
    return null
  }

  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="button button-secondary button-small"
        onClick={() => onChange(page - 1)}
        disabled={disabled || page <= 1}
      >
        Previous
      </button>
      <span className="muted">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        className="button button-secondary button-small"
        onClick={() => onChange(page + 1)}
        disabled={disabled || page >= totalPages}
      >
        Next
      </button>
    </nav>
  )
}
