import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError, getErrorMessage } from '../../lib/api'
import {
  createRequestId,
  draftStorageKey,
  hasDraftContent,
  loadLocalDraft,
  pruneLocalDrafts,
  removeLocalDraft,
  serializeDraftFields,
  type BylineMode,
  type DraftFields,
  type LocalDraft,
} from '../../lib/drafts'
import type { AuthUser, Category, Tag } from '../../types'
import type { EditorMode, EditorSaveStatus, SaveState } from './types'
import { useLocalDraftAutosave } from './useLocalDraftAutosave'
import { useServerAutosave } from './useServerAutosave'
import { useUnsavedChanges } from './useUnsavedChanges'

interface UsePostEditorOptions {
  mode: EditorMode
  slug: string | undefined
  user: AuthUser | null
}

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

function getSaveStatus({
  hydrated,
  mode,
  isDirty,
  saveState,
  saveMessage,
}: {
  hydrated: boolean
  mode: EditorMode
  isDirty: boolean
  saveState: SaveState
  saveMessage: string | null
}): EditorSaveStatus | null {
  if (!hydrated) {
    return null
  }

  if (mode === 'create') {
    if (!isDirty) {
      return null
    }

    if (saveState === 'local') {
      return { state: 'local', text: 'Draft stored locally.' }
    }

    if (saveState === 'error') {
      return { state: 'error', text: 'Draft could not be stored locally.' }
    }

    return { state: 'dirty', text: 'Saving draft locally…' }
  }

  switch (saveState) {
    case 'saving':
      return { state: 'saving', text: 'Saving…' }
    case 'conflict':
      return { state: 'conflict', text: saveMessage ?? 'Newer server changes detected.' }
    case 'offline':
      return { state: 'offline', text: saveMessage ?? 'Offline. Draft stored locally.' }
    case 'error':
      return { state: 'error', text: saveMessage ?? 'Autosave failed. Draft stored locally.' }
    case 'local':
      return { state: 'local', text: 'Draft stored locally.' }
    case 'dirty':
      return {
        state: 'dirty',
        text: navigator.onLine ? 'Unsaved changes.' : 'Offline. Draft stored locally.',
      }
    case 'saved':
      return { state: 'saved', text: 'All changes saved.' }
  }
}

export function usePostEditor({ mode, slug, user }: UsePostEditorOptions) {
  const navigate = useNavigate()

  const [fields, setFields] = useState<DraftFields>(emptyDraftFields)
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [postId, setPostId] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [hydrated, setHydrated] = useState(mode === 'create')
  const [loading, setLoading] = useState(mode === 'edit')
  const [editorKey, setEditorKey] = useState(0)
  const [recovery, setRecovery] = useState<LocalDraft | null>(() => {
    if (mode !== 'create' || !user) {
      return null
    }

    const key = draftStorageKey(user.id, null)
    const local = loadLocalDraft(key)

    if (local && hasDraftContent(local)) {
      return local
    }

    if (local) {
      removeLocalDraft(key)
    }

    return null
  })
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string | null>(() =>
    mode === 'create' ? serializeDraftFields(emptyDraftFields()) : null,
  )
  const [saving, setSaving] = useState(false)
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

  const snapshot = serializeDraftFields(fields)
  const draftKey = user ? draftStorageKey(user.id, postId) : null
  const isDirty = hydrated && lastSavedSnapshot !== snapshot
  const displayName =
    fields.bylineMode === 'anonymous'
      ? null
      : fields.bylineMode === 'custom'
        ? fields.customName.trim() || null
        : (user?.username ?? null)
  const recoveryOutdated =
    recovery !== null && mode === 'edit' && recovery.baseVersion !== version
  const saveStatus = getSaveStatus({ hydrated, mode, isDirty, saveState, saveMessage })

  useEffect(() => {
    currentSnapshotRef.current = snapshot
  }, [snapshot])

  useEffect(() => {
    pruneLocalDrafts()
  }, [])

  useEffect(() => {
    let cancelled = false

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

    if (mode !== 'edit' || !slug) {
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
        setFields(loadedFields)

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
        setLoading(false)
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(getErrorMessage(loadError))
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [mode, slug, user])

  useLocalDraftAutosave({
    hydrated,
    draftKey,
    isDirty,
    mode,
    fields,
    lastSavedSnapshotRef,
    currentSnapshotRef,
    versionRef,
    setSaveState,
    setSaveMessage,
  })

  useServerAutosave({
    mode,
    postId,
    hydrated,
    recovery,
    isDirty,
    retryToken,
    saveState,
    snapshot,
    fields,
    displayName,
    draftKey,
    versionRef,
    postIdRef,
    lastSavedSnapshotRef,
    currentSnapshotRef,
    autosavePromiseRef,
    savingRef,
    setVersion,
    setLastSavedSnapshot,
    setSaveState,
    setSaveMessage,
    setRetryToken,
  })

  useUnsavedChanges({ isDirty, setSaveState, setSaveMessage, setRetryToken })

  function clearRecovery() {
    if (!recovery) {
      return
    }

    setRecovery(null)
    setSaveMessage(null)
  }

  function updateField<K extends keyof DraftFields>(key: K, value: DraftFields[K]) {
    clearRecovery()
    setFields((current) => ({ ...current, [key]: value }))
  }

  function toggleTag(tagId: string) {
    clearRecovery()
    setFields((current) => ({
      ...current,
      tagIds: current.tagIds.includes(tagId)
        ? current.tagIds.filter((id) => id !== tagId)
        : [...current.tagIds, tagId],
    }))
  }

  function applyRecoveredDraft(draft: LocalDraft) {
    setFields({
      title: draft.title,
      content: draft.content,
      excerpt: draft.excerpt,
      status: draft.status,
      categoryId: draft.categoryId,
      tagIds: draft.tagIds,
      bylineMode: draft.bylineMode,
      customName: draft.customName,
    })
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

    const { title, content, excerpt, status, categoryId, tagIds, bylineMode } = fields

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

  return {
    fields,
    categories,
    tags,
    loading,
    recovery,
    recoveryOutdated,
    saving,
    saveStatus,
    error,
    editorKey,
    updateField,
    toggleTag,
    applyRecoveredDraft,
    discardRecoveredDraft,
    handleSubmit,
  }
}
