"use client"

import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react"
import { useUser } from "@auth0/nextjs-auth0/client"
import { ReactNode, useCallback, useMemo } from "react"

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

function useAuth() {
  const { user, isLoading } = useUser()

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      try {
        const response = await fetch("/auth/access-token", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        })
        if (!response.ok) return null
        const { token } = await response.json()
        return token ?? null
      } catch {
        return null
      }
    },
    []
  )

  return useMemo(
    () => ({
      isLoading,
      isAuthenticated: !!user,
      fetchAccessToken,
    }),
    [isLoading, user, fetchAccessToken]
  )
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithAuth>
  )
}
