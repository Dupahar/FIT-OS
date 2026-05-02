import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '@/lib/api'
import type { AuthTokens } from '@/types'

interface AuthState {
  access_token: string | null
  refresh_token: string | null
  tenant_id: string | null
  user_role: string | null
  _refreshTimer: ReturnType<typeof setTimeout> | null

  setTokens: (tokens: AuthTokens, tenantId: string) => void
  logout: () => void
  silentRefresh: () => Promise<boolean>
  scheduleRefresh: () => void
}

function decodeBase64Url(value: string) {
  let normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = normalized.length % 4
  if (padding) {
    normalized += '='.repeat(4 - padding)
  }
  return atob(normalized)
}

function readRoleFromToken(token: string | null) {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1]))
    return typeof payload?.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      access_token: null,
      refresh_token: null,
      tenant_id: null,
      user_role: null,
      _refreshTimer: null,

      setTokens: (tokens: AuthTokens, tenantId: string) => {
        const role = readRoleFromToken(tokens.access_token)
        set({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          tenant_id: tenantId,
          user_role: role,
        })
        get().scheduleRefresh()
      },

      logout: () => {
        const timer = get()._refreshTimer
        if (timer) clearTimeout(timer)
        set({
          access_token: null,
          refresh_token: null,
          tenant_id: null,
          user_role: null,
          _refreshTimer: null,
        })
        // Don't do window.location.href — let React's ProtectedRoute redirect
      },

      silentRefresh: async () => {
        const refreshToken = get().refresh_token
        if (!refreshToken) return false

        try {
          const res = await api.post('/v1/auth/refresh', {
            refresh_token: refreshToken,
          })
          const tokens = res.data as AuthTokens
          const role = readRoleFromToken(tokens.access_token)
          set({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            user_role: role,
          })
          get().scheduleRefresh()
          return true
        } catch {
          get().logout()
          return false
        }
      },

      scheduleRefresh: () => {
        const timer = get()._refreshTimer
        if (timer) clearTimeout(timer)

        // Refresh 5 minutes before expiry (token expires in 15m)
        const newTimer = setTimeout(
          () => {
            get().silentRefresh()
          },
          10 * 60 * 1000, // 10 minutes
        )
        set({ _refreshTimer: newTimer })
      },
    }),
    {
      name: 'fit_auth',
      partialize: (state) => ({
        access_token: state.access_token,
        refresh_token: state.refresh_token,
        tenant_id: state.tenant_id,
        user_role: state.user_role,
      }),
    },
  ),
)

// Sync auth state across browser tabs
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'fit_auth') {
      useAuthStore.persist.rehydrate()
    }
  })
}
