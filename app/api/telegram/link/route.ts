import { auth0 } from "@/lib/auth0"
import { ConvexHttpClient } from "convex/browser"
import { api } from "@/convex/_generated/api"
import { encrypt } from "@/lib/encryption"
import { NextResponse } from "next/server"

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export async function GET(req: Request) {
  const session = await auth0.getSession()
  if (!session) {
    // Redirect to login, then back to this URL
    const url = new URL(req.url)
    const returnTo = `${url.pathname}${url.search}`
    return NextResponse.redirect(
      new URL(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`, url.origin)
    )
  }

  const url = new URL(req.url)
  const code = url.searchParams.get("code")

  if (!code) {
    return NextResponse.redirect(
      new URL("/dashboard?error=missing_code", url.origin)
    )
  }

  const userId = session.user.sub

  try {
    await convex.mutation(api.telegramLinks.consumeLinkingCode, {
      code,
      userId,
    })

    // Store the Auth0 refresh token so the backend can exchange it
    // for fresh Google tokens via Token Vault
    const refreshToken = (session.tokenSet as { refreshToken?: string })?.refreshToken
    if (refreshToken) {
      const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL
      if (siteUrl && process.env.CONVEX_API_SECRET) {
        await fetch(`${siteUrl}/api/store-refresh-token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.CONVEX_API_SECRET}`,
          },
          body: JSON.stringify({ userId, auth0RefreshToken: await encrypt(refreshToken) }),
        })
      }
    }

    return NextResponse.redirect(
      new URL("/dashboard?telegram=linked", url.origin)
    )
  } catch (err) {
    const message = encodeURIComponent(String(err))
    return NextResponse.redirect(
      new URL(`/dashboard?error=${message}`, url.origin)
    )
  }
}
