import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { api, ApiError, getErrorMessage } from '../lib/api'
import {
  createRequestId,
  draftStorageKey,
  hasDraftContent,
  loadLocalDraft,
  pruneLocalDrafts,
  removeLocalDraft,
  saveLocalDraft,
  serializeDraftFields,
  type BylineMode,
  type DraftFields,
  type LocalDraft,
} from '../lib/drafts'
import type { Category, PostStatus, Tag } from '../types'

const RichTextEditor = lazy(() =>
  import('../components/RichTextEditor').then((module) => ({ default: module.RichTextEditor })),
)

const LOCAL_AUTOSAVE_DELAY_MS = 800
const SERVER_AUTOSAVE_DELAY_MS = 4000

interface EditorPageProps {
  mode: 'create' | 'edit'
}

type SaveState = 'saved' | 'dirty' | 'local' | 'saving' | 'offline' | 'conflict' | 'error'

function emptyDraftFields(): DraftFields {
  return {
    title: '',
    content: '',
    excerpt: '',
    status: 'draft',
    categoryId: '',
    tagIds: [],
    bylineMode: 'username',
    customName: '',
  }
}

function conflictVersion(error: ApiError): number | null {
  const details = error.details as { current?: { version?: unknown } } | null | undefined
  const value = details?.current?.version

  return typeof value === 'number' ? value : null
}

export function EditorPage({ mode }: EditorPageProps) {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [postId, setPostId] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [status, setStatus] = useState<PostStatus>('draft')
  const [categoryId, setCategoryId] = useState('')
  const [tagIds, setTagIds] = useState<string[]>([])
  const [bylineMode, setBylineMode] = useState<BylineMode>('username')
  const [customName, setCustomName] = useState('')

  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])

  const [loadedSlug, setLoadedSlug] = useState<string | null>(null)
  const [editorKey, setEditorKey] = useState(0)
  const [hydrated, setHydrated] = useState(false)
  const [recovery, setRecovery] = useState<LocalDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const versionRef = useRef(0)
  const postIdRef = useRef<string | null>(null)
  const lastSavedSnapshotRef = useRef<string | null>(null)
  const currentSnapshotRef = useRef('')
  const autosavePromiseRef = useRef<Promise<void> | null>(null)
  const savingRef = useRef(false)
  const createRequestRef = useRef<{ signature: string; id: string } | null>(null)

  const loading = mode === 'edit' && loadedSlug !== slug
  const missingSlug = mode === 'edit' && !slug

  const draftFields: DraftFields = {
    title,
    content,
    excerpt,
    status,
    categoryId,
    tagIds,
    bylineMode,
    customName,
  }
  const snapshot = serializeDraftFields(draftFields)

  const draftKey = user ? draftStorageKey(user.id, postId) : null
  const isDirty = hydrated && lastSavedSnapshot !== snapshot
  const displayName =
    bylineMode === 'anonymous'
      ? null
      : bylineMode === 'custom'
        ? customName.trim() || null
        : (user?.username ?? null)

  useEffect(() => {
    currentSnapshotRef.current = snapshot
  }, [snapshot])

  useEffect(() => {
    pruneLocalDrafts()
  }, [])

  useEffect(() => {
    let cancelled = false

    if (mode === 'edit') {
      setHydrated(false)
      setRecovery(null)
    }

    Promise.all([api.listCategories(), api.listTags()])
      .then(([categoryList, tagList]) => {
        if (!cancelled) {
          setCategories(categoryList)
          setTags(tagList)
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(getErrorMessage(loadError))
        }
      })

    if (mode === 'edit') {
      if (!slug) {
        return () => {
          cancelled = true
        }
      }

      api
        .getPost(slug)
        .then((post) => {
          if (cancelled) {
            return
          }

          let loadedBylineMode: BylineMode = 'custom'
          let loadedCustomName = post.author_name ?? ''

          if (user && post.author_name === user.username) {
            loadedBylineMode = 'username'
            loadedCustomName = ''
          } else if (post.author_name === null) {
            loadedBylineMode = 'anonymous'
            loadedCustomName = ''
          }

          const loadedFields: DraftFields = {
            title: post.title,
            content: post.content,
            excerpt: post.excerpt ?? '',
            status: post.status,
            categoryId: post.category_id ?? '',
            tagIds: post.tags.map((tag) => tag.id),
            bylineMode: loadedBylineMode,
            customName: loadedCustomName,
          }

          setPostId(post.id)
          setVersion(post.version)
          setTitle(loadedFields.title)
          setContent(loadedFields.content)
          setExcerpt(loadedFields.excerpt)
          setStatus(loadedFields.status)
          setCategoryId(loadedFields.categoryId)
          setTagIds(loadedFields.tagIds)
          setBylineMode(loadedFields.bylineMode)
          setCustomName(loadedFields.customName)

          const loadedSnapshot = serializeDraftFields(loadedFields)
          versionRef.current = post.version
          postIdRef.current = post.id
          lastSavedSnapshotRef.current = loadedSnapshot
          setLastSavedSnapshot(loadedSnapshot)
          setSaveState('saved')
          setSaveMessage(null)

          if (user) {
            const key = draftStorageKey(user.id, post.id)
            const local = loadLocalDraft(key)

            if (
              local &&
              hasDraftContent(local) &&
              serializeDraftFields(local) !== serializeDraftFields(loadedFields)
            ) {
              setRecovery(local)
            } else if (local) {
              removeLocalDraft(key)
            }
          }

          setHydrated(true)
          setLoadedSlug(slug)
        })
        .catch((loadError: unknown) => {
          if (!cancelled) {
            setError(getErrorMessage(loadError))
            setLoadedSlug(slug)
          }
        })
    }

    return () => {
      cancelled = true
    }
  }, [mode, slug, user])

  useEffect(() => {
    if (mode !== 'create') {
      return
    }

    const fields = emptyDraftFields()

    setPostId(null)
    postIdRef.current = null
    setVersion(0)
    versionRef.current = 0
    setTitle(fields.title)
    setContent(fields.content)
    setExcerpt(fields.excerpt)
    setStatus(fields.status)
    setCategoryId(fields.categoryId)
    setTagIds(fields.tagIds)
    setBylineMode(fields.bylineMode)
    setCustomName(fields.customName)
    const initialSnapshot = serializeDraftFields(fields)
    lastSavedSnapshotRef.current = initialSnapshot
    setLastSavedSnapshot(initialSnapshot)
    setRecovery(null)
    setSaveState('saved')
    setSaveMessage(null)

    if (user) {
      const key = draftStorageKey(user.id, null)
      const local = loadLocalDraft(key)

      if (local && hasDraftContent(local)) {
        setRecovery(local)
      } else if (local) {
        removeLocalDraft(key)
      }
    }

    setHydrated(true)
  }, [mode, user])

  useEffect(() => {
    if (!hydrated || !draftKey || !isDirty) {
      return
    }

    if (recovery) {
      setRecovery(null)
      setSaveMessage(null)
      return
    }

    const fields: DraftFields = {
      title,
      content,
      excerpt,
      status,
      categoryId,
      tagIds,
      bylineMode,
      customName,
    }

    if (!hasDraftContent(fields)) {
      removeLocalDraft(draftKey)
      return
    }

    const timer = window.setTimeout(() => {
      if (lastSavedSnapshotRef.current === currentSnapshotRef.current) {
        return
      }

      const draft: LocalDraft = {
        ...fields,
        savedAt: new Date().toISOString(),
        baseVersion: mode === 'edit' ? versionRef.current : null,
      }

      if (saveLocalDraft(draftKey, draft)) {
        setSaveState((current) =>
          current === 'conflict' || current === 'offline' ? current : 'local',
        )
      } else {
        setSaveState('error')
        setSaveMessage('Could not store a local draft in this browser.')
      }
    }, LOCAL_AUTOSAVE_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [
    hydrated,
    draftKey,
    isDirty,
    recovery,
    mode,
    snapshot,
    title,
    content,
    excerpt,
    status,
    categoryId,
    tagIds,
    bylineMode,
    customName,
  ])

  useEffect(() => {
    if (
      mode !== 'edit' ||
      !postId ||
      !hydrated ||
      recovery ||
      savingRef.current ||
      !isDirty ||
      !title.trim() ||
      !content.trim() ||
      content.length > 100_000 ||
      (bylineMode === 'custom' && !customName.trim()) ||
      saveState === 'conflict' ||
      saveState === 'offline' ||
      saveState === 'error' ||
      autosavePromiseRef.current
    ) {
      return
    }

    const requestPostId = postId
    const timer = window.setTimeout(() => {
      if (savingRef.current || postIdRef.current !== requestPostId) {
        return
      }

      const sentSnapshot = snapshot
      const sentVersion = versionRef.current

      const requestPromise = api
        .updatePost(requestPostId, {
          version: sentVersion,
          title: title.trim(),
          content,
          excerpt: excerpt.trim() || null,
          status,
          categoryId: categoryId || null,
          tagIds,
          displayName,
        })
        .then((updated) => {
          if (postIdRef.current !== requestPostId) {
            return
          }

          versionRef.current = updated.version
          setVersion(updated.version)

          if (currentSnapshotRef.current === sentSnapshot) {
            lastSavedSnapshotRef.current = sentSnapshot
            setLastSavedSnapshot(sentSnapshot)
            if (draftKey) {
              removeLocalDraft(draftKey)
            }
            setSaveState('saved')
          } else {
            setSaveState('dirty')
          }

          setSaveMessage(null)
        })
        .catch((saveError: unknown) => {
          if (postIdRef.current !== requestPostId) {
            return
          }

          if (saveError instanceof ApiError && saveError.status === 409) {
            setSaveState('conflict')
            setSaveMessage('Another session saved newer changes. Your draft is still stored locally.')
            return
          }

          setSaveState(navigator.onLine ? 'error' : 'offline')
          setSaveMessage('Autosave failed. Your draft is still stored locally.')
        })
        .finally(() => {
          autosavePromiseRef.current = null

          if (postIdRef.current === requestPostId) {
            setRetryToken((token) => token + 1)
          }
        })

      autosavePromiseRef.current = requestPromise
    }, SERVER_AUTOSAVE_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [
    mode,
    postId,
    hydrated,
    recovery,
    isDirty,
    retryToken,
    saveState,
    snapshot,
    title,
    content,
    excerpt,
    status,
    categoryId,
    tagIds,
    bylineMode,
    customName,
    displayName,
    draftKey,
  ])

  useEffect(() => {
    const handleOffline = () => {
      if (isDirty) {
        setSaveState('offline')
        setSaveMessage('You are offline. Your draft is stored locally.')
      }
    }

    const handleOnline = () => {
      setSaveState((current) => (current === 'offline' ? 'dirty' : current))
      setRetryToken((token) => token + 1)
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [isDirty])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) {
        return
      }

      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  function toggleTag(tagId: string) {
    setTagIds((current) =>
      current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId],
    )
  }

  function applyRecoveredDraft(draft: LocalDraft) {
    setTitle(draft.title)
    setContent(draft.content)
    setExcerpt(draft.excerpt)
    setStatus(draft.status)
    setCategoryId(draft.categoryId)
    setTagIds(draft.tagIds)
    setBylineMode(draft.bylineMode)
    setCustomName(draft.customName)
    setEditorKey((current) => current + 1)
    setRecovery(null)
    setError(null)

    if (mode === 'edit' && draft.baseVersion !== version) {
      setSaveState('conflict')
      setSaveMessage('Recovered draft is based on an older copy. Saving will overwrite newer changes.')
    } else {
      setSaveState('dirty')
      setSaveMessage('Recovered local draft. Review it before saving.')
    }
  }

  function discardRecoveredDraft() {
    if (draftKey) {
      removeLocalDraft(draftKey)
    }

    setRecovery(null)
    setSaveMessage(null)
    setSaveState('saved')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!title.trim() || !content.trim()) {
      setError('Title and content are required.')
      return
    }

    if (bylineMode === 'custom' && !displayName) {
      setError('Enter a display name, or choose a different byline option.')
      return
    }

    savingRef.current = true
    setSaving(true)
    setError(null)
    setSaveMessage(null)
    setSaveState('saving')

    const submittedSnapshot = snapshot
    const trimmedExcerpt = excerpt.trim()
    const input = {
      title: title.trim(),
      content,
      status,
      categoryId: categoryId || null,
      tagIds,
      displayName,
      ...(trimmedExcerpt ? { excerpt: trimmedExcerpt } : {}),
    }

    try {
      if (autosavePromiseRef.current) {
        await autosavePromiseRef.current
      }

      if (mode === 'edit') {
        if (!postId) {
          throw new Error('Post has not loaded yet')
        }

        const updated = await api.updatePost(postId, {
          ...input,
          version: versionRef.current,
          excerpt: trimmedExcerpt || null,
        })

        versionRef.current = updated.version
        setVersion(updated.version)
        lastSavedSnapshotRef.current = submittedSnapshot
        setLastSavedSnapshot(submittedSnapshot)

        if (currentSnapshotRef.current === submittedSnapshot) {
          if (draftKey) {
            removeLocalDraft(draftKey)
          }
          navigate(`/posts/${updated.slug}`)
        } else {
          setSaveState('dirty')
          setSaveMessage('Saved, but newer edits are still unsaved.')
        }
      } else {
        if (createRequestRef.current?.signature !== submittedSnapshot) {
          createRequestRef.current = {
            signature: submittedSnapshot,
            id: createRequestId(),
          }
        }

        const created = await api.createPost({
          ...input,
          clientRequestId: createRequestRef.current.id,
        })

        createRequestRef.current = null

        if (draftKey) {
          removeLocalDraft(draftKey)
        }

        navigate(`/posts/${created.slug}`)
      }
    } catch (saveError) {
      if (mode === 'edit' && saveError instanceof ApiError && saveError.status === 409) {
        const nextVersion = conflictVersion(saveError)

        if (nextVersion !== null) {
          versionRef.current = nextVersion
          setVersion(nextVersion)
        }

        setSaveState('conflict')
        setSaveMessage(
          'Another session saved newer changes. Your draft is kept; save again to replace that copy, or reload first.',
        )
        setError(getErrorMessage(saveError))
      } else {
        setSaveState(navigator.onLine ? 'error' : 'offline')
        setSaveMessage('Save failed. Your draft is stored locally when possible.')
        setError(getErrorMessage(saveError))
      }
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  if (missingSlug) {
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

  if (loading) {
    return <p className="page-status">Loading post…</p>
  }

  let saveStatus: { state: SaveState; text: string } | null = null

  if (hydrated) {
    if (mode === 'create') {
      if (isDirty) {
        saveStatus =
          saveState === 'local'
            ? { state: 'local', text: 'Draft stored locally.' }
            : saveState === 'error'
              ? { state: 'error', text: 'Draft could not be stored locally.' }
              : { state: 'dirty', text: 'Saving draft locally…' }
      }
    } else {
      switch (saveState) {
        case 'saving':
          saveStatus = { state: 'saving', text: 'Saving…' }
          break
        case 'conflict':
          saveStatus = {
            state: 'conflict',
            text: saveMessage ?? 'Newer server changes detected.',
          }
          break
        case 'offline':
          saveStatus = {
            state: 'offline',
            text: saveMessage ?? 'Offline. Draft stored locally.',
          }
          break
        case 'error':
          saveStatus = {
            state: 'error',
            text: saveMessage ?? 'Autosave failed. Draft stored locally.',
          }
          break
        case 'local':
          saveStatus = { state: 'local', text: 'Draft stored locally.' }
          break
        case 'dirty':
          saveStatus = {
            state: 'dirty',
            text: navigator.onLine ? 'Unsaved changes.' : 'Offline. Draft stored locally.',
          }
          break
        case 'saved':
          saveStatus = { state: 'saved', text: 'All changes saved.' }
          break
      }
    }
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

      {error && <p className="error">{error}</p>}

      <form className="editor-form" onSubmit={handleSubmit}>
        {recovery && (
          <section className="draft-banner" role="status">
            <div>
              <strong>Local draft found</strong>
              <p className="muted">
                Saved {new Date(recovery.savedAt).toLocaleString()}. Recover it, or keep editing to
                discard it.
                {mode === 'edit' && recovery.baseVersion !== version
                  ? ' The server copy changed since this draft was saved.'
                  : ''}
              </p>
            </div>
            <div className="actions">
              <button
                type="button"
                className="button button-small"
                onClick={() => applyRecoveredDraft(recovery)}
              >
                Recover draft
              </button>
              <button
                type="button"
                className="button button-secondary button-small"
                onClick={discardRecoveredDraft}
              >
                Discard draft
              </button>
            </div>
          </section>
        )}

        <label>
          <span>Title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            required
          />
        </label>

        <label>
          <span>Excerpt</span>
          <textarea
            value={excerpt}
            onChange={(event) => setExcerpt(event.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Optional short summary shown on the home page."
          />
        </label>

        <div className="editor-field">
          <span>Content</span>
          <Suspense fallback={<p className="muted">Loading editor…</p>}>
            <RichTextEditor
              key={`${postId ?? 'new'}-${editorKey}`}
              markdown={content}
              onChange={setContent}
            />
          </Suspense>
        </div>

        <div className="editor-row">
          <label>
            <span>Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as PostStatus)}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>

          <label>
            <span>Category</span>
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
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
              value={bylineMode}
              onChange={(event) => setBylineMode(event.target.value as BylineMode)}
            >
              <option value="username">
                {user ? `My username (${user.username})` : 'My username'}
              </option>
              <option value="anonymous">Anonymous</option>
              <option value="custom">Custom name</option>
            </select>
          </label>

          {bylineMode === 'custom' && (
            <label>
              <span>Display name</span>
              <input
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
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
                    checked={tagIds.includes(tag.id)}
                    onChange={() => toggleTag(tag.id)}
                  />
                  <span>{tag.name}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        {saveStatus && (
          <p className="save-status" data-state={saveStatus.state}>
            {saveStatus.text}
          </p>
        )}

        <div className="actions">
          <button type="submit" className="button" disabled={saving}>
            {saving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Create post'}
          </button>
        </div>
      </form>
    </div>
  )
}
