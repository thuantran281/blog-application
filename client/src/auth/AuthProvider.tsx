import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, setUnauthorizedHandler } from '../lib/api'
import type { AuthUser } from '../types'
import { AuthContext } from './context'

const LEGACY_TOKEN_KEY = 'blog-api-token'

function removeLegacyToken(): void {
  try {
    localStorage.removeItem(LEGACY_TOKEN_KEY)
  } catch {
    return
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    removeLegacyToken()
    setUnauthorizedHandler(() => setUser(null))

    return () => setUnauthorizedHandler(null)
  }, [])

  useEffect(() => {
    let cancelled = false

    api
      .me()
      .then((currentUser) => {
        if (!cancelled) {
          setUser(currentUser)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const auth = await api.login({ email, password })
    setUser(auth.user)
  }, [])

  const register = useCallback(async (username: string, email: string, password: string) => {
    const auth = await api.register({ username, email, password })
    setUser(auth.user)
  }, [])

  const logout = useCallback(async () => {
    await api.logout().catch(async () => {
      await api.csrf().catch(() => undefined)
      await api.logout().catch(() => undefined)
    })

    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
