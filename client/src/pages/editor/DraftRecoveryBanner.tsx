import type { LocalDraft } from '../../lib/drafts'

interface DraftRecoveryBannerProps {
  recovery: LocalDraft
  recoveryOutdated: boolean
  onRecover: () => void
  onDiscard: () => void
}

export function DraftRecoveryBanner({
  recovery,
  recoveryOutdated,
  onRecover,
  onDiscard,
}: DraftRecoveryBannerProps) {
  return (
    <section className="draft-banner" role="status">
      <div>
        <strong>Local draft found</strong>
        <p className="muted">
          Saved {new Date(recovery.savedAt).toLocaleString()}. Recover it, or keep editing to
          discard it.
          {recoveryOutdated ? ' The server copy changed since this draft was saved.' : ''}
        </p>
      </div>
      <div className="actions">
        <button type="button" className="button button-small" onClick={onRecover}>
          Recover draft
        </button>
        <button
          type="button"
          className="button button-secondary button-small"
          onClick={onDiscard}
        >
          Discard draft
        </button>
      </div>
    </section>
  )
}
