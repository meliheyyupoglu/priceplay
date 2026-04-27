import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import * as authApi from '../api/authApi'
import type { User } from '../types'

const STORAGE_KEY = 'priceplay_session_v1'

type AuthContextValue = {
  user: User | null
  loading: boolean
  login: (identifier: string, password: string) => Promise<void>
  register: (p: {
    firstName: string
    lastName: string
    nickname: string
    email: string
    phone: string
    password: string
  }) => Promise<void>
  logout: () => void
  refreshProfile: () => Promise<void>
  updateProfile: (p: {
    firstName: string
    lastName: string
    nickname: string
    phone: string
  }) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function loadStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const u = JSON.parse(raw) as User
    if (u?.id) return u
  } catch {
    /* ignore */
  }
  return null
}

function saveUser(u: User | null) {
  if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
  else localStorage.removeItem(STORAGE_KEY)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setUser(loadStoredUser())
    setLoading(false)
  }, [])

  const login = useCallback(async (identifier: string, password: string) => {
    const u = await authApi.login(identifier, password)
    setUser(u)
    saveUser(u)
  }, [])

  const register = useCallback(
    async (p: {
      firstName: string
      lastName: string
      nickname: string
      email: string
      phone: string
      password: string
    }) => {
      const u = await authApi.register(p)
      setUser(u)
      saveUser(u)
    },
    [],
  )

  const logout = useCallback(() => {
    setUser(null)
    saveUser(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return
    const u = await authApi.fetchMe(user.id)
    setUser(u)
    saveUser(u)
  }, [user?.id])

  const updateProfile = useCallback(
    async (p: { firstName: string; lastName: string; nickname: string; phone: string }) => {
      if (!user?.id) throw new Error('Giriş gerekli')
      const u = await authApi.updateProfile(user.id, p)
      setUser(u)
      saveUser(u)
    },
    [user?.id],
  )

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refreshProfile,
      updateProfile,
    }),
    [user, loading, login, register, logout, refreshProfile, updateProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth inside AuthProvider')
  return ctx
}
