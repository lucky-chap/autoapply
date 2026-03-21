import { auth0 } from "@/lib/auth0"
import { ConvexHttpClient } from "convex/browser"
import { api } from "@/convex/_generated/api"
import { listGmailMessages, getGmailMessage } from "@/lib/gmail"
import { callGLM } from "@/lib/glm"
import { NextResponse } from "next/server"

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

function extractBody(payload: { parts?: { mimeType: string; body?: { data?: string } }[]; body?: { data?: string } }): string {
  if (payload.parts) {
    const textPart = payload.parts.find(
      (p: { mimeType: string }) => p.mimeType === "text/plain"
    )
    if (textPart?.body?.data) {
      return Buffer.from(textPart.body.data, "base64url").toString("utf-8")
    }
  }
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf-8")
  }
  return ""
}

export async function POST(req: Request) {
  const session = await auth0.getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const userId = session.user.sub

  // Retrieve Gmail read token
  let accessToken: string
  try {
    const tokenResponse = await auth0.getAccessTokenForConnection({
      connection: "google-oauth2",
    }) as { token: string }
    accessToken = tokenResponse.token
  } catch {
    return NextResponse.json(
      { error: "Gmail not connected." },
      { status: 400 }
    )
  }

  // Get user's applications to know which companies to check
  const applications = await convex.query(api.applications.getByUser, { userId })
  const appliedApps = applications.filter(
    (a) => a.status === "Applied" || a.status === "Replied"
  )

  if (appliedApps.length === 0) {
    return NextResponse.json({ message: "No pending applications to check.", updated: 0 })
  }

  let updatedCount = 0

  for (const app of appliedApps) {
    // Search Gmail for replies from this company
    const query = `from:${app.recipientEmail} newer_than:7d`
    const listResult = await listGmailMessages(accessToken, query, 3)

    if (!listResult.messages || listResult.messages.length === 0) continue

    // Get the most recent message
    const message = await getGmailMessage(
      accessToken,
      listResult.messages[0].id
    )
    const bodyText = extractBody(message.payload)

    if (!bodyText) continue

    // Classify the reply using GLM-4-Flash (fast + cheap)
    const classifyPrompt = `You are classifying a recruiter's email reply to a job application.

The candidate applied for the role of "${app.role}" at "${app.company}".

EMAIL REPLY:
${bodyText.slice(0, 2000)}

Classify this email into EXACTLY ONE of these categories:
- "Replied" — general acknowledgement or interest
- "Interview" — scheduling an interview or requesting availability
- "Offer" — extending a job offer
- "Rejected" — rejection or position filled

Return ONLY the category word, nothing else.`

    const classification = await callGLM(classifyPrompt)
    const status = classification.trim().replace(/['"]/g, "")

    const validStatuses = ["Replied", "Interview", "Offer", "Rejected"] as const
    const matchedStatus = validStatuses.find(
      (s) => status.toLowerCase() === s.toLowerCase()
    )

    if (matchedStatus && matchedStatus !== app.status) {
      await convex.mutation(api.applications.updateStatus, {
        id: app._id,
        status: matchedStatus,
      })
      updatedCount++
    }
  }

  return NextResponse.json({ success: true, updated: updatedCount })
}
