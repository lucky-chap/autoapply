import { auth0 } from "@/lib/auth0"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth0.getSession()
  if (!session) {
    return NextResponse.json({ error: "No session" }, { status: 401 })
  }

  // Try to get an access token for the My Account API
  let meTokenResult: Record<string, unknown> = {}
  try {
    const token = await auth0.getAccessToken({
      audience: `https://${process.env.AUTH0_DOMAIN!.replace(/^https?:\/\//, "").replace(/\/$/, "")}/me/`,
      scope: "create:me:connected_accounts",
    })
    meTokenResult = {
      success: true,
      tokenPrefix: typeof token === "string"
        ? token.substring(0, 20) + "..."
        : token?.accessToken?.substring(0, 20) + "...",
    }
  } catch (e: unknown) {
    const err = e as Error & { code?: string; cause?: unknown }
    meTokenResult = {
      success: false,
      error: err.message,
      code: err.code,
      cause: String(err.cause),
    }
  }

  return NextResponse.json({
    hasRefreshToken: !!session.tokenSet?.refreshToken,
    scope: session.tokenSet?.scope,
    expiresAt: session.tokenSet?.expiresAt,
    meTokenExchange: meTokenResult,
  })
}
