import { internalAction } from "./_generated/server"
import { internal } from "./_generated/api"

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

async function getAuth0ManagementToken(
  domain: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const res = await fetch(`https://${domain}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      audience: `https://${domain}/api/v2/`,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Auth0 M2M token error (${res.status}): ${err}`)
  }

  const data = await res.json()
  return data.access_token
}

async function getGmailTokenForUser(
  domain: string,
  managementToken: string,
  userId: string
): Promise<string | null> {
  const res = await fetch(
    `https://${domain}/api/v2/users/${encodeURIComponent(userId)}?fields=identities`,
    {
      headers: { Authorization: `Bearer ${managementToken}` },
    }
  )

  if (!res.ok) return null

  const data = await res.json()
  const googleIdentity = data.identities?.find(
    (id: { connection: string }) => id.connection === "google-oauth2"
  )

  return googleIdentity?.access_token ?? null
}

function extractBody(payload: {
  parts?: { mimeType: string; body?: { data?: string } }[]
  body?: { data?: string }
}): string {
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

async function checkReplyForApp(
  app: {
    _id: string
    recipientEmail: string
    gmailThreadId?: string
    role: string
    company: string
  },
  accessToken: string
): Promise<{ mimePayload: unknown } | null> {
  if (app.gmailThreadId) {
    const threadRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${app.gmailThreadId}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (threadRes.ok) {
      const thread = await threadRes.json()
      const replies = (thread.messages || []).filter(
        (msg: { payload?: { headers?: { name: string; value: string }[] } }) => {
          const fromHeader = msg.payload?.headers?.find(
            (h: { name: string }) => h.name.toLowerCase() === "from"
          )
          return fromHeader && fromHeader.value.includes(app.recipientEmail)
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
    const domain = process.env.AUTH0_DOMAIN!
    const m2mClientId = process.env.AUTH0_M2M_CLIENT_ID!
    const m2mClientSecret = process.env.AUTH0_M2M_CLIENT_SECRET!
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

    const managementToken = await getAuth0ManagementToken(
      domain,
      m2mClientId,
      m2mClientSecret
    )

    let totalChecked = 0
    let totalUpdated = 0

    for (const [userId, userApps] of byUser) {
      const gmailToken = await getGmailTokenForUser(
        domain,
        managementToken,
        userId
      )

      if (!gmailToken) {
        console.log(`[cron] No Gmail token for user ${userId}, skipping.`)
        continue
      }

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
          gmailToken
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

Classify this email into EXACTLY ONE of these categories:
- "Replied" — general acknowledgement or interest
- "Interview" — scheduling an interview or requesting availability
- "Offer" — extending a job offer
- "Rejected" — rejection or position filled

Return ONLY the category word, nothing else.`

        const classification = await callGLM(classifyPrompt, glmApiKey)
        const status = classification.trim().replace(/['"]/g, "")

        const validStatuses = [
          "Replied",
          "Interview",
          "Offer",
          "Rejected",
        ] as const
        const matchedStatus = validStatuses.find(
          (s) => status.toLowerCase() === s.toLowerCase()
        )

        if (matchedStatus) {
          await ctx.runMutation(
            internal.applications.internalUpdateStatus,
            { id: app._id, status: matchedStatus }
          )
          totalUpdated++
        }
      }
    }

    console.log(
      `[cron] Checked ${totalChecked} applications across ${byUser.size} users. Updated ${totalUpdated}.`
    )
  },
})
