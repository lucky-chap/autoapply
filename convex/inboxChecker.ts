import { internalAction } from "./_generated/server"
import { internal } from "./_generated/api"
import { getGmailTokenViaTokenVault, TokenVaultError } from "./tokenVault"
import { getAuth0ManagementToken, getUserEmail } from "./auth0"

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
    lastCheckedGmailMsgId?: string
    role: string
    company: string
  },
  accessToken: string,
  senderEmail: string
): Promise<{ mimePayload: unknown; gmailMsgId: string } | null> {
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
        const latestReply = replies[replies.length - 1]
        const msgId = latestReply.id as string
        // Skip if we already processed this exact message
        if (app.lastCheckedGmailMsgId === msgId) return null
        return { mimePayload: latestReply.payload, gmailMsgId: msgId }
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
          const msgId = listData.messages[0].id as string
          if (app.lastCheckedGmailMsgId === msgId) return null
          return { mimePayload: msg.payload, gmailMsgId: msgId }
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
        if (err instanceof TokenVaultError && err.isReauthRequired) {
          // Notify via Telegram if linked
          const link = await ctx.runQuery(
            internal.telegramLinks.getLinkByUserIdInternal,
            { userId }
          )
          if (link) {
            const siteUrl = process.env.APP_BASE_URL || "the web app"
            await ctx.runAction(internal.telegram.sendNotification, {
              chatId: link.telegramChatId,
              text:
                `🔑 <b>Re-authorization required</b>\n\n` +
                `Your Google session has expired so I can't check for replies.\n` +
                `Please visit ${siteUrl} and send an application to refresh your session.`,
            })
          }
        }
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
            lastCheckedGmailMsgId: app.lastCheckedGmailMsgId,
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

Return a JSON object with three fields:
1. "status" — EXACTLY ONE of: "Replied", "Interview", "Offer", "Rejected"
   - "Replied" — general acknowledgement, interest, or questions
   - "Interview" — scheduling an interview or requesting availability
   - "Offer" — extending a job offer
   - "Rejected" — rejection or position filled
2. "summary" — A 1-2 sentence plain text summary of what the reply says, so the candidate knows what it's about without reading the full email
3. "actionNeeded" — boolean. true if the candidate needs to respond or take action (e.g. reply to a question, schedule an interview, negotiate an offer). false if informational only (e.g. rejection, auto-acknowledgement like "we received your application", or a confirmation that needs no reply).
   Rules:
   - "Rejected" → always false
   - "Interview" → always true
   - "Offer" → always true
   - "Replied" → true if the recruiter is asking a question or requesting something; false if it's just an acknowledgement or auto-reply
4. "mentionedSalary" — If the email mentions a specific salary or compensation number, extract it as a number (annual amount). If no salary is mentioned, set to null.

Return ONLY the JSON object, no markdown, no explanation.`

        const classificationRaw = await callGLM(classifyPrompt, glmApiKey)
        let status = ""
        let replySummary = ""
        let actionNeeded = true
        let mentionedSalary: number | null = null
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
            actionNeeded = parsed.actionNeeded !== false
            mentionedSalary = typeof parsed.mentionedSalary === "number" ? parsed.mentionedSalary : null
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

        if (!matchedStatus) continue

        const statusChanged = matchedStatus !== app.status

        // Always update lastCheckedGmailMsgId, and status if it changed
        await ctx.runMutation(
          internal.applications.internalUpdateStatus,
          {
            id: app._id,
            status: statusChanged ? matchedStatus : app.status,
            lastCheckedGmailMsgId: reply.gmailMsgId,
          }
        )
        if (statusChanged) totalUpdated++

        // Always notify on new replies (this is a new message we haven't seen)
        const telegramLink = await ctx.runQuery(
          internal.telegramLinks.getLinkByUserIdInternal,
          { userId: app.userId }
        )
        if (telegramLink) {
          const emoji =
            matchedStatus === "Interview" ? "📅" :
            matchedStatus === "Offer" ? "🎉" :
            matchedStatus === "Rejected" ? "😔" : "💬"
          const statusLine = statusChanged
            ? `Status: <b>${matchedStatus}</b> (was ${app.status})`
            : `Status: <b>${matchedStatus}</b>`
          const summaryLine = replySummary
            ? `\n\n📝 <b>Summary:</b> ${replySummary}`
            : ""
          const actionLine = actionNeeded
            ? "\n\n👉 <b>Action needed</b> — check your email and respond."
            : "\n\n<i>No action needed on your part.</i>"

          // Salary alert for offers
          let salaryAlert = ""
          if (matchedStatus === "Offer" && mentionedSalary !== null) {
            const prefs = await ctx.runQuery(
              internal.preferences.getByUserInternal,
              { userId: app.userId }
            )
            if (prefs?.minSalary && mentionedSalary < prefs.minSalary) {
              salaryAlert = `\n\n⚠️ <b>Salary alert:</b> The mentioned compensation (~$${mentionedSalary.toLocaleString()}) appears below your minimum of $${prefs.minSalary.toLocaleString()}.`
            }
          }

          await ctx.runAction(internal.telegram.sendNotification, {
            chatId: telegramLink.telegramChatId,
            text: `${emoji} <b>${app.company}</b> update for <b>${app.role}</b>\n\n${statusLine}${summaryLine}${salaryAlert}${actionLine}`,
          })
        }
      }
    }

    console.log(
      `[cron] Checked ${totalChecked} applications across ${byUser.size} users. Updated ${totalUpdated}.`
    )
  },
})
