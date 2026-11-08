export function pgErrorCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code?: unknown }).code
    return typeof code === 'string' ? code : undefined
  }

  return undefined
}

export function isUniqueViolation(err: unknown): boolean {
  return pgErrorCode(err) === '23505'
}

export function isForeignKeyViolation(err: unknown): boolean {
  return pgErrorCode(err) === '23503'
}
