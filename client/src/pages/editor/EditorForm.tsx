import { lazy, Suspense } from 'react'
import type { FormEvent } from 'react'
import type { BylineMode, DraftFields, LocalDraft } from '../../lib/drafts'
import type { AuthUser, Category, PostStatus, Tag } from '../../types'
import { DraftRecoveryBanner } from './DraftRecoveryBanner'
import { SaveStatus } from './SaveStatus'
import type { EditorMode, EditorSaveStatus } from './types'

const RichTextEditor = lazy(() =>
  import('../../components/RichTextEditor').then((module) => ({ default: module.RichTextEditor })),
)

interface EditorFormProps {
  mode: EditorMode
  user: AuthUser | null
  fields: DraftFields
  categories: Category[]
  tags: Tag[]
  recovery: LocalDraft | null
  recoveryOutdated: boolean
  saving: boolean
  saveStatus: EditorSaveStatus | null
  editorKey: number
  onFieldChange: <K extends keyof DraftFields>(key: K, value: DraftFields[K]) => void
  onToggleTag: (tagId: string) => void
  onApplyRecoveredDraft: (draft: LocalDraft) => void
  onDiscardRecoveredDraft: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function EditorForm({
  mode,
  user,
  fields,
  categories,
  tags,
  recovery,
  recoveryOutdated,
  saving,
  saveStatus,
  editorKey,
  onFieldChange,
  onToggleTag,
  onApplyRecoveredDraft,
  onDiscardRecoveredDraft,
  onSubmit,
}: EditorFormProps) {
  return (
    <form className="editor-form" onSubmit={onSubmit}>
      {recovery && (
        <DraftRecoveryBanner
          recovery={recovery}
          recoveryOutdated={recoveryOutdated}
          onRecover={() => onApplyRecoveredDraft(recovery)}
          onDiscard={onDiscardRecoveredDraft}
        />
      )}

      <label>
        <span>Title</span>
        <input
          value={fields.title}
          onChange={(event) => onFieldChange('title', event.target.value)}
          maxLength={200}
          required
        />
      </label>

      <label>
        <span>Excerpt</span>
        <textarea
          value={fields.excerpt}
          onChange={(event) => onFieldChange('excerpt', event.target.value)}
          maxLength={500}
          rows={2}
          placeholder="Optional short summary shown on the home page."
        />
      </label>

      <div className="editor-field">
        <span>Content</span>
        <Suspense fallback={<p className="muted">Loading editor…</p>}>
          <RichTextEditor
            key={editorKey}
            markdown={fields.content}
            onChange={(value) => onFieldChange('content', value)}
          />
        </Suspense>
      </div>

      <div className="editor-row">
        <label>
          <span>Status</span>
          <select
            value={fields.status}
            onChange={(event) => onFieldChange('status', event.target.value as PostStatus)}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>

        <label>
          <span>Category</span>
          <select
            value={fields.categoryId}
            onChange={(event) => onFieldChange('categoryId', event.target.value)}
          >
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="editor-row">
        <label>
          <span>Publish as</span>
          <select
            value={fields.bylineMode}
            onChange={(event) =>
              onFieldChange('bylineMode', event.target.value as BylineMode)
            }
          >
            <option value="username">
              {user ? `My username (${user.username})` : 'My username'}
            </option>
            <option value="anonymous">Anonymous</option>
            <option value="custom">Custom name</option>
          </select>
        </label>

        {fields.bylineMode === 'custom' && (
          <label>
            <span>Display name</span>
            <input
              value={fields.customName}
              onChange={(event) => onFieldChange('customName', event.target.value)}
              maxLength={100}
              placeholder="Pen name"
              required
            />
          </label>
        )}
      </div>

      <fieldset className="tag-picker">
        <legend>Tags</legend>
        {tags.length === 0 ? (
          <p className="muted">No tags available yet.</p>
        ) : (
          <div className="tag-options">
            {tags.map((tag) => (
              <label key={tag.id} className="checkbox">
                <input
                  type="checkbox"
                  checked={fields.tagIds.includes(tag.id)}
                  onChange={() => onToggleTag(tag.id)}
                />
                <span>{tag.name}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <SaveStatus status={saveStatus} />

      <div className="actions">
        <button type="submit" className="button" disabled={saving}>
          {saving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Create post'}
        </button>
      </div>
    </form>
  )
}
