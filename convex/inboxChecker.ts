import { internalAction } from "./_generated/server"
import { internal } from "./_generated/api"
import {
  getGmailTokenViaTokenVault,
  getAuth0ManagementToken,
  getUserEmail,
} from "./tokenVault"

// Decode base64url to UTF-8 string (Convex runtime has no Node Buffer)
function fromBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/")
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

const GLM_BASE_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions"

async function callGLM(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(GLM_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "glm-4.7-flash",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4000,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`GLM API error (${response.status}): ${err}`)
  }

  const data = await response.json()
  return data.choices[0].message.content ?? ""
}

// Auth helpers moved to tokenVault.ts

function extractBody(payload: {
  parts?: { mimeType: string; body?: { data?: string } }[]
  body?: { data?: string }
}): string {
  if (payload.parts) {
    const textPart = payload.parts.find(
      (p: { mimeType: string }) => p.mimeType === "text/plain"
    )
    if (textPart?.body?.data) {
      return fromBase64Url(textPart.body.data)
    }
  }
  if (payload.body?.data) {
    return fromBase64Url(payload.body.data)
  }
  return ""
}

async function checkReplyForApp(
  app: {
    _id: string
    recipientEmail: string
    gmailThreadId?: string
    role: string
    company: string
  },
  accessToken: string,
  senderEmail: string
): Promise<{ mimePayload: unknown } | null> {
  if (app.gmailThreadId) {
    const threadRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${app.gmailThreadId}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (threadRes.ok) {
      const thread = await threadRes.json()
      const messages = thread.messages || []

      // Skip if thread only has 1 message (the one we sent)
      if (messages.length <= 1) return null

      // Find messages NOT sent by us (i.e. replies from the recipient)
      const replies = messages.filter(
        (msg: { payload?: { headers?: { name: string; value: string }[] } }) => {
          const fromHeader = msg.payload?.headers?.find(
            (h: { name: string }) => h.name.toLowerCase() === "from"
          )
          if (!fromHeader) return false
          const fromValue = fromHeader.value.toLowerCase()
          // Exclude messages from ourselves
          if (senderEmail && fromValue.includes(senderEmail.toLowerCase())) return false
          // Must be from someone (ideally the recipient)
          return true
        }
      )
      if (replies.length > 0) {
        return { mimePayload: replies[replies.length - 1].payload }
      }
    }
  } else {
    const query = `from:${app.recipientEmail} newer_than:7d`
    const params = new URLSearchParams({ q: query, maxResults: "3" })
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (listRes.ok) {
      const listData = await listRes.json()
      if (listData.messages && listData.messages.length > 0) {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${listData.messages[0].id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        if (msgRes.ok) {
          const msg = await msgRes.json()
          return { mimePayload: msg.payload }
        }
      }
    }
  }
  return null
}

export const checkAllInboxes = internalAction({
  args: {},
  handler: async (ctx) => {
    const glmApiKey = process.env.GLM_API_KEY!

    const applications = await ctx.runQuery(
      internal.applications.getActiveApplications,
      {}
    )

    if (applications.length === 0) {
      console.log("[cron] No active applications to check.")
      return
    }

    // Group by userId
    const byUser = new Map<string, typeof applications>()
    for (const app of applications) {
      const list = byUser.get(app.userId) ?? []
      list.push(app)
      byUser.set(app.userId, list)
    }

    let totalChecked = 0
    let totalUpdated = 0

    // Get management token once for all user lookups
    let managementToken: string
    try {
      managementToken = await getAuth0ManagementToken()
    } catch (err) {
      console.log(`[cron] Failed to get management token: ${err}`)
      return
    }

    for (const [userId, userApps] of byUser) {
      let gmailToken: string
      try {
        gmailToken = await getGmailTokenViaTokenVault(ctx, userId)
      } catch (err) {
        console.log(`[cron] Token Vault failed for user ${userId}: ${err}`)
        continue
      }

      // Get sender email to filter out our own messages from threads
      const userInfo = await getUserEmail(managementToken, userId)
      const senderEmail = userInfo?.email ?? ""

      for (const app of userApps) {
        totalChecked++
        const reply = await checkReplyForApp(
          {
            _id: app._id,
            recipientEmail: app.recipientEmail,
            gmailThreadId: app.gmailThreadId,
            role: app.role,
            company: app.company,
          },
          gmailToken,
          senderEmail
        )

        if (!reply) continue

        const bodyText = extractBody(
          reply.mimePayload as {
            parts?: { mimeType: string; body?: { data?: string } }[]
            body?: { data?: string }
          }
        )
        if (!bodyText) continue

        const classifyPrompt = `You are classifying a recruiter's email reply to a job application.

The candidate applied for the role of "${app.role}" at "${app.company}".

EMAIL REPLY:
${bodyText.slice(0, 2000)}

Return a JSON object with two fields:
1. "status" — EXACTLY ONE of: "Replied", "Interview", "Offer", "Rejected"
   - "Replied" — general acknowledgement or interest
   - "Interview" — scheduling an interview or requesting availability
   - "Offer" — extending a job offer
   - "Rejected" — rejection or position filled
2. "summary" — A 1-2 sentence plain text summary of what the reply says, so the candidate knows what it's about without reading the full email

Return ONLY the JSON object, no markdown, no explanation.`

        const classificationRaw = await callGLM(classifyPrompt, glmApiKey)
        let status = ""
        let replySummary = ""
        try {
          const cleaned = classificationRaw
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```\s*$/, "")
            .trim()
          const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            status = String(parsed.status || "").trim().replace(/['"]/g, "")
            replySummary = String(parsed.summary || "").trim()
          }
        } catch {
          // Fallback: treat raw output as just the status
          status = classificationRaw.trim().replace(/['"]/g, "")
        }

        const validStatuses = [
          "Replied",
          "Interview",
          "Offer",
          "Rejected",
        ] as const
        const matchedStatus = validStatuses.find(
          (s) => status.toLowerCase() === s.toLowerCase()
        )

        if (matchedStatus && matchedStatus !== app.status) {
          await ctx.runMutation(
            internal.applications.internalUpdateStatus,
            { id: app._id, status: matchedStatus }
          )
          totalUpdated++

          // Send Telegram notification if user has a linked account
          const telegramLink = await ctx.runQuery(
            internal.telegramLinks.getLinkByUserIdInternal,
            { userId: app.userId }
          )
          if (telegramLink) {
            const emoji =
              matchedStatus === "Interview" ? "📅" :
              matchedStatus === "Offer" ? "🎉" :
              matchedStatus === "Rejected" ? "😔" : "💬"
            const summaryLine = replySummary
              ? `\n\n📝 *Summary:* ${replySummary}`
              : ""
            await ctx.runAction(internal.telegram.sendNotification, {
              chatId: telegramLink.telegramChatId,
              text: `${emoji} *${app.company}* update for *${app.role}*\n\nStatus: *${matchedStatus}*${summaryLine}`,
            })
          }
        }
      }
    }

    console.log(
      `[cron] Checked ${totalChecked} applications across ${byUser.size} users. Updated ${totalUpdated}.`
    )
  },
})
