import { auth0 } from "@/lib/auth0"
import { ConvexHttpClient } from "convex/browser"
import { api } from "@/convex/_generated/api"
import { encodeEmail, sendGmailMessage } from "@/lib/gmail"
import { NextResponse } from "next/server"

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export async function POST(req: Request) {
  const session = await auth0.getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Check for step-up auth — require recent MFA
  const claims = session.user
  const authTime = claims.auth_time as number | undefined
  const now = Math.floor(Date.now() / 1000)
  const MAX_AGE_SECONDS = 300 // 5 minutes — user must have authenticated recently

  if (!authTime || now - authTime > MAX_AGE_SECONDS) {
    return NextResponse.json(
      {
        requiresStepUp: true,
        message: "Step-up authentication required. Please re-authenticate with MFA.",
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
    return NextResponse.json(
      { error: "Gmail send failed", detail: String(err) },
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
