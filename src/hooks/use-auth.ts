'use client'

import { useSession, signIn, signOut } from 'next-auth/react'

export function useAuth() {
  const { data: session, status } = useSession()

  return {
    user: session?.user ?? null,
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
    login: (email: string, password: string) =>
      signIn('credentials', { email, password, redirect: false }),
    register: async (data: { name: string; username: string; email: string; password: string }) => {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (result.success) {
        return signIn('credentials', { email: data.email, password: data.password, redirect: false })
      }
      throw new Error(result.error || 'Registration failed')
    },
    logout: () => signOut({ redirect: false }),
  }
}
