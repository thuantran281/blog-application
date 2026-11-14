import { useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { SaveState } from './types'

interface UseUnsavedChangesOptions {
  isDirty: boolean
  setSaveState: Dispatch<SetStateAction<SaveState>>
  setSaveMessage: Dispatch<SetStateAction<string | null>>
  setRetryToken: Dispatch<SetStateAction<number>>
}

export function useUnsavedChanges({
  isDirty,
  setSaveState,
  setSaveMessage,
  setRetryToken,
}: UseUnsavedChangesOptions) {
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
  }, [isDirty, setSaveState, setSaveMessage, setRetryToken])

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
}
