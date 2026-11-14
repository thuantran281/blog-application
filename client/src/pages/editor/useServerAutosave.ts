import { useEffect } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import { api, ApiError } from '../../lib/api'
import { removeLocalDraft, type DraftFields, type LocalDraft } from '../../lib/drafts'
import type { EditorMode, SaveState } from './types'

const SERVER_AUTOSAVE_DELAY_MS = 4000

interface UseServerAutosaveOptions {
  mode: EditorMode
  postId: string | null
  hydrated: boolean
  recovery: LocalDraft | null
  isDirty: boolean
  retryToken: number
  saveState: SaveState
  snapshot: string
  fields: DraftFields
  displayName: string | null
  draftKey: string | null
  versionRef: RefObject<number>
  postIdRef: RefObject<string | null>
  lastSavedSnapshotRef: RefObject<string | null>
  currentSnapshotRef: RefObject<string>
  autosavePromiseRef: RefObject<Promise<void> | null>
  savingRef: RefObject<boolean>
  setVersion: Dispatch<SetStateAction<number>>
  setLastSavedSnapshot: Dispatch<SetStateAction<string | null>>
  setSaveState: Dispatch<SetStateAction<SaveState>>
  setSaveMessage: Dispatch<SetStateAction<string | null>>
  setRetryToken: Dispatch<SetStateAction<number>>
}

export function useServerAutosave({
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
}: UseServerAutosaveOptions) {
  useEffect(() => {
    const { title, content, excerpt, status, categoryId, tagIds, bylineMode, customName } = fields

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
  ])
}
