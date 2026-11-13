import type { EditorSaveStatus } from './types'

interface SaveStatusProps {
  status: EditorSaveStatus | null
}

export function SaveStatus({ status }: SaveStatusProps) {
  if (!status) {
    return null
  }

  return (
    <p className="save-status" data-state={status.state}>
      {status.text}
    </p>
  )
}
