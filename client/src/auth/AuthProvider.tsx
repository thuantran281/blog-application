import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, getStoredToken, storeToken } from '../lib/api'
import type { AuthUser } from '../types'
import { AuthContext } from './context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(() => getStoredToken() !== null)

  useEffect(() => {
    const token = getStoredToken()

    if (!token) {
      return
    }

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
          storeToken(null)
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
    storeToken(auth.token)
    setUser(auth.user)
  }, [])

  const register = useCallback(async (username: string, email: string, password: string) => {
    const auth = await api.register({ username, email, password })
    storeToken(auth.token)
    setUser(auth.user)
  }, [])

  const logout = useCallback(() => {
    storeToken(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
