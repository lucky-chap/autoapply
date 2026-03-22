import { auth0 } from "@/lib/auth0"
import { ConvexHttpClient } from "convex/browser"
import { api } from "@/convex/_generated/api"
import { encodeEmail, sendGmailMessage } from "@/lib/gmail"
import { NextResponse } from "next/server"

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export async function POST(req: Request) {
  const session = await auth0.getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Step-up auth: require recent authentication
  // Decode the ID token to get iat (issued-at) since session.user doesn't include it
  const tokenSet = session.tokenSet as { idToken?: string; expiresAt?: number } | undefined
  let iat: number | undefined
  if (tokenSet?.idToken) {
    try {
      const payload = JSON.parse(Buffer.from(tokenSet.idToken.split(".")[1], "base64url").toString())
      iat = payload.iat as number
    } catch {
      // fall back to expiresAt - 24h
      if (tokenSet.expiresAt) iat = tokenSet.expiresAt - 86400
    }
  }

  const now = Math.floor(Date.now() / 1000)
  const MAX_AGE_SECONDS = 300 // 5 minutes

  if (!iat || now - iat > MAX_AGE_SECONDS) {
    return NextResponse.json(
      {
        requiresStepUp: true,
        message: "Step-up authentication required. Please re-authenticate.",
      },
      { status: 403 }
    )
  }

  const { to, subject, body, company, role, coverLetter } = await req.json()
  const userId = session.user.sub

  // Retrieve Gmail token from Token Vault
  let accessToken: string
  try {
    const tokenResponse = await auth0.getAccessTokenForConnection({
      connection: "google-oauth2",
    }) as { token: string }
    accessToken = tokenResponse.token
  } catch {
    return NextResponse.json(
      { error: "Gmail not connected. Please connect Google in Permissions." },
      { status: 400 }
    )
  }

  // Send via Gmail API
  const encodedEmail = encodeEmail({ to, subject, body })
  try {
    await sendGmailMessage(accessToken, encodedEmail)
  } catch (err) {
    console.error("[send-application] Gmail error:", String(err))
    return NextResponse.json(
      { error: `Gmail send failed: ${String(err)}` },
      { status: 500 }
    )
  }

  // Log to Convex — triggers real-time Kanban update
  await convex.mutation(api.applications.create, {
    userId,
    company,
    role,
    coverLetter,
    recipientEmail: to,
  })

  return NextResponse.json({ success: true })
}
