import type { PostStatus } from '../types'

export type BylineMode = 'username' | 'anonymous' | 'custom'

export interface DraftFields {
  title: string
  content: string
  excerpt: string
  status: PostStatus
  categoryId: string
  tagIds: string[]
  bylineMode: BylineMode
  customName: string
}

export interface LocalDraft extends DraftFields {
  savedAt: string
  baseVersion: number | null
}

const DRAFT_PREFIX = 'blog-draft:'
const MAX_DRAFT_AGE_MS = 30 * 24 * 60 * 60 * 1000

export function draftStorageKey(userId: string, postId: string | null): string {
  return `${DRAFT_PREFIX}${userId}:${postId ?? 'new'}`
}

export function serializeDraftFields(fields: DraftFields): string {
  return JSON.stringify({
    title: fields.title,
    content: fields.content,
    excerpt: fields.excerpt,
    status: fields.status,
    categoryId: fields.categoryId,
    tagIds: [...fields.tagIds].sort(),
    bylineMode: fields.bylineMode,
    customName: fields.customName,
  })
}

export function hasDraftContent(draft: DraftFields): boolean {
  return Boolean(draft.title.trim() || draft.content.trim() || draft.excerpt.trim())
}

export function createRequestId(): string {
  return crypto.randomUUID()
}

export function loadLocalDraft(key: string): LocalDraft | null {
  try {
    const raw = localStorage.getItem(key)

    if (!raw) {
      return null
    }

    const value: unknown = JSON.parse(raw)

    if (typeof value !== 'object' || value === null) {
      return null
    }

    const draft = value as Partial<LocalDraft>

    if (
      typeof draft.title !== 'string' ||
      typeof draft.content !== 'string' ||
      typeof draft.excerpt !== 'string' ||
      (draft.status !== 'draft' && draft.status !== 'published') ||
      typeof draft.categoryId !== 'string' ||
      !Array.isArray(draft.tagIds) ||
      !draft.tagIds.every((id) => typeof id === 'string') ||
      (draft.bylineMode !== 'username' &&
        draft.bylineMode !== 'anonymous' &&
        draft.bylineMode !== 'custom') ||
      typeof draft.customName !== 'string' ||
      typeof draft.savedAt !== 'string' ||
      (draft.baseVersion !== null && typeof draft.baseVersion !== 'number')
    ) {
      return null
    }

    return draft as LocalDraft
  } catch {
    return null
  }
}

export function saveLocalDraft(key: string, draft: LocalDraft): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}

export function removeLocalDraft(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Storage may be unavailable in privacy-restricted browsers.
  }
}

export function pruneLocalDrafts(now = Date.now()): void {
  try {
    const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
      .filter((key): key is string => key?.startsWith(DRAFT_PREFIX) === true)
      .slice()

    for (const key of keys) {
      const draft = loadLocalDraft(key)
      const savedAt = draft ? Date.parse(draft.savedAt) : Number.NaN

      if (!draft || !Number.isFinite(savedAt) || now - savedAt > MAX_DRAFT_AGE_MS) {
        removeLocalDraft(key)
      }
    }
  } catch {
    // Storage may be unavailable; draft recovery is best-effort.
  }
}
