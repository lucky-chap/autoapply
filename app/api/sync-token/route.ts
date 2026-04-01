import { auth0 } from "@/lib/auth0"
import { encrypt } from "@/lib/encryption"
import { NextResponse } from "next/server"

/**
 * POST /api/sync-token
 *
 * Stores the user's current Auth0 refresh token in Convex so that
 * background services (cron inbox checker, Telegram bot, auto-apply)
 * can access Gmail on the user's behalf.
 *
 * Called by the dashboard layout on page load to keep the token fresh.
 */
export async function POST() {
  const session = await auth0.getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.sub
  const refreshToken = (session.tokenSet as any)?.refresh_token || (session.tokenSet as any)?.refreshToken

  if (!refreshToken) {
    console.warn("[sync-token] no refresh token in session for user:", userId)
    return NextResponse.json({ synced: false, reason: "no_refresh_token" })
  }

  // Also verify Gmail connection is active by trying getAccessTokenForConnection
  let gmailConnected = false
  try {
    await auth0.getAccessTokenForConnection({ connection: "google-oauth2" })
    gmailConnected = true
  } catch {
    console.warn("[sync-token] Gmail not connected for user:", userId)
  }

  const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL
  if (!siteUrl || !process.env.CONVEX_API_SECRET) {
    return NextResponse.json({ synced: false, reason: "missing_config" })
  }

  try {
    const res = await fetch(`${siteUrl}/api/store-refresh-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CONVEX_API_SECRET}`,
      },
      body: JSON.stringify({
        userId,
        auth0RefreshToken: await encrypt(refreshToken),
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error("[sync-token] store failed:", res.status, err)
      return NextResponse.json({ synced: false, reason: "store_rejected", status: res.status })
    }
    console.log("[sync-token] token synced for user:", userId, "gmail:", gmailConnected)
    return NextResponse.json({ synced: true, gmailConnected })
  } catch (err) {
    console.error("[sync-token] fetch error:", err)
    return NextResponse.json({ synced: false, reason: "store_failed" })
  }
}
