export type EditorMode = 'create' | 'edit'

export type SaveState = 'saved' | 'dirty' | 'local' | 'saving' | 'offline' | 'conflict' | 'error'

export interface EditorSaveStatus {
  state: SaveState
  text: string
}
