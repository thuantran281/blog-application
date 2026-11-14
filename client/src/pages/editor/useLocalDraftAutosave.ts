import { useEffect } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import {
  hasDraftContent,
  removeLocalDraft,
  saveLocalDraft,
  type DraftFields,
  type LocalDraft,
} from '../../lib/drafts'
import type { EditorMode, SaveState } from './types'

const LOCAL_AUTOSAVE_DELAY_MS = 800

interface UseLocalDraftAutosaveOptions {
  hydrated: boolean
  draftKey: string | null
  isDirty: boolean
  mode: EditorMode
  fields: DraftFields
  lastSavedSnapshotRef: RefObject<string | null>
  currentSnapshotRef: RefObject<string>
  versionRef: RefObject<number>
  setSaveState: Dispatch<SetStateAction<SaveState>>
  setSaveMessage: Dispatch<SetStateAction<string | null>>
}

export function useLocalDraftAutosave({
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
}: UseLocalDraftAutosaveOptions) {
  useEffect(() => {
    if (!hydrated || !draftKey || !isDirty) {
      return
    }

    const currentFields = fields

    if (!hasDraftContent(currentFields)) {
      removeLocalDraft(draftKey)
      return
    }

    const timer = window.setTimeout(() => {
      if (lastSavedSnapshotRef.current === currentSnapshotRef.current) {
        return
      }

      const draft: LocalDraft = {
        ...currentFields,
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
    mode,
    fields,
    lastSavedSnapshotRef,
    currentSnapshotRef,
    versionRef,
    setSaveState,
    setSaveMessage,
  ])
}
