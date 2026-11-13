import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/context'
import type { AuthUser } from '../types'
import { EditorForm } from './editor/EditorForm'
import { usePostEditor } from './editor/usePostEditor'
import type { EditorMode } from './editor/types'

interface EditorPageProps {
  mode: EditorMode
}

export function EditorPage({ mode }: EditorPageProps) {
  const { slug } = useParams<{ slug: string }>()
  const { user } = useAuth()

  if (mode === 'edit' && !slug) {
    return (
      <div className="empty-state">
        <h2>Post not found</h2>
        <p className="muted">This edit link is missing a post slug.</p>
        <Link className="button" to="/my-posts">
          Back to my posts
        </Link>
      </div>
    )
  }

  return (
    <EditorSession
      key={`${mode}:${slug ?? 'new'}:${user?.id ?? 'guest'}`}
      mode={mode}
      slug={slug}
      user={user}
    />
  )
}

interface EditorSessionProps {
  mode: EditorMode
  slug: string | undefined
  user: AuthUser | null
}

function EditorSession({ mode, slug, user }: EditorSessionProps) {
  const editor = usePostEditor({ mode, slug, user })

  if (editor.loading) {
    return <p className="page-status">Loading post…</p>
  }

  return (
    <div className="stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{mode === 'edit' ? 'Edit post' : 'New post'}</p>
          <h1>{mode === 'edit' ? 'Shape your story' : 'Write something new'}</h1>
        </div>
        <Link
          className="button button-secondary"
          to={mode === 'edit' && slug ? `/posts/${slug}` : '/'}
        >
          Cancel
        </Link>
      </section>

      {editor.error && <p className="error">{editor.error}</p>}

      <EditorForm
        mode={mode}
        user={user}
        fields={editor.fields}
        categories={editor.categories}
        tags={editor.tags}
        recovery={editor.recovery}
        recoveryOutdated={editor.recoveryOutdated}
        saving={editor.saving}
        saveStatus={editor.saveStatus}
        editorKey={editor.editorKey}
        onFieldChange={editor.updateField}
        onToggleTag={editor.toggleTag}
        onApplyRecoveredDraft={editor.applyRecoveredDraft}
        onDiscardRecoveredDraft={editor.discardRecoveredDraft}
        onSubmit={editor.handleSubmit}
      />
    </div>
  )
}
