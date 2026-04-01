"use client"

import { useEffect } from "react"

/**
 * Invisible component that syncs the user's Auth0 refresh token
 * to Convex on mount. This keeps background services (cron inbox
 * checker, Telegram bot) authorized to access Gmail.
 */
export function TokenSync() {
  useEffect(() => {
    fetch("/api/sync-token", { method: "POST" }).catch(() => {
      // Silent — token sync is best-effort
    })
  }, [])

  return null
}
