import { auth0 } from "@/lib/auth0"
import { ConvexHttpClient } from "convex/browser"
import { api } from "@/convex/_generated/api"
import { listGmailMessages, getGmailMessage } from "@/lib/gmail"
import { callVertex } from "@/lib/vertex"
import { NextResponse } from "next/server"

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

function extractBody(payload: { parts?: { mimeType: string; body?: { data?: string } }[]; body?: { data?: string } }): string {
  if (payload.parts) {
    const textPart = payload.parts.find(
      (p: { mimeType: string }) => p.mimeType === "text/plain"
    )
    if (textPart?.body?.data) {
      return Buffer.from(textPart.body.data, "base64").toString("utf-8")
    }
  }
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8")
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
  } catch (err) {
    const message = String(err)
    if (message.includes("expired") || message.includes("invalid_grant")) {
      return NextResponse.json(
        { error: "Gmail token expired. Please reconnect Google in Permissions." },
        { status: 401 }
      )
    }
    return NextResponse.json(
      { error: "Gmail not connected. Please connect Google in Permissions." },
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
    let replyMessage = null

    if (app.gmailThreadId) {
      // Preferred: check the specific Gmail thread for replies from the recipient
      const threadRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${app.gmailThreadId}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (threadRes.ok) {
        const thread = await threadRes.json()
        // Find messages in the thread from the recipient (not from the user)
        const replies = (thread.messages || []).filter(
          (msg: { payload?: { headers?: { name: string; value: string }[] } }) => {
            const fromHeader = msg.payload?.headers?.find(
              (h: { name: string }) => h.name.toLowerCase() === "from"
            )
            if (!fromHeader) return false
            const fromValue = fromHeader.value.toLowerCase()
            const userEmail = session.user.email?.toLowerCase() || ""
            
            // It's a reply if it's NOT from the user's own email.
            // This handles cases where recruiters reply from different aliases.
            return userEmail && !fromValue.includes(userEmail)
          }
        )
        if (replies.length > 0) {
          replyMessage = replies[replies.length - 1]
        }
      }
    } else {
      // Fallback for older applications without threadId
      const query = `from:${app.recipientEmail} newer_than:7d`
      const listResult = await listGmailMessages(accessToken, query, 3)
      if (listResult.messages && listResult.messages.length > 0) {
        replyMessage = await getGmailMessage(accessToken, listResult.messages[0].id)
      }
    }

    if (!replyMessage) continue

    const bodyText = extractBody(replyMessage.payload)

    if (!bodyText) continue

    // Classify the reply using GLM-4-Flash (fast + cheap)
    const classifyPrompt = `
      Classify this email reply for a job application for "${app.role}" at "${app.company}":
      
      "${bodyText}"

      Return a JSON object:
      {
        "status": "Replied" | "Interview" | "Offer" | "Rejected",
        "summary": "Short 1-sentence summary",
        "schedulingLink": "URL if found, else null"
      }
    `;

    const classificationRaw = await callVertex(classifyPrompt);
    let matchedStatus: "Replied" | "Interview" | "Offer" | "Rejected" | null = null;
    try {
      const jsonMatch = classificationRaw.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      
      const validStatuses = ["Replied", "Interview", "Offer", "Rejected"] as const;
      matchedStatus = validStatuses.find(
        (s) => String(parsed.status || "").toLowerCase() === s.toLowerCase()
      ) || null;

      if (matchedStatus && matchedStatus !== app.status) {
        await convex.mutation(api.applications.updateStatus, {
          id: app._id,
          status: matchedStatus,
          lastCheckedGmailMsgId: replyMessage.id,
        });
        updatedCount++;
      }
    } catch (e) {
      console.error("Classification failed for", app.company, e);
    }
  }

  return NextResponse.json({ success: true, updated: updatedCount })
}
