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

  // Create Convex record first to get applicationId for tracking pixel
  const applicationId = await convex.mutation(api.applications.create, {
    userId,
    company,
    role,
    coverLetter,
    recipientEmail: to,
  })

  // Build tracking pixel URL
  const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL
  const trackingPixelUrl = siteUrl
    ? `${siteUrl}/track/open?id=${applicationId}`
    : undefined

  // Build sender info from session
  const from = session.user.name && session.user.email
    ? { name: session.user.name as string, email: session.user.email as string }
    : undefined

  // Send via Gmail API with tracking pixel
  const encodedEmail = encodeEmail({ to, subject, body, from, trackingPixelUrl })
  let gmailResult: { id: string; threadId: string }
  try {
    gmailResult = await sendGmailMessage(accessToken, encodedEmail)
  } catch (err) {
    // Clean up the record if send fails
    try {
      await convex.mutation(api.applications.deleteById, { id: applicationId })
    } catch {
      // Best effort cleanup
    }
    console.error("[send-application] Gmail error:", String(err))
    return NextResponse.json(
      { error: `Gmail send failed: ${String(err)}` },
      { status: 500 }
    )
  }

  // Store the Gmail thread ID for accurate reply checking
  if (gmailResult.threadId) {
    try {
      await convex.mutation(api.applications.setThreadId, {
        id: applicationId,
        gmailThreadId: gmailResult.threadId,
      })
    } catch {
      // Non-critical — reply checking will fall back to email search
    }
  }

  return NextResponse.json({ success: true, applicationId })
}
