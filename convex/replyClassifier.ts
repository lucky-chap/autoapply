/**
 * Gmail reply detection and AI classification.
 *
 * Extracts reply bodies from Gmail threads and classifies them
 * using GLM into status categories (Replied, Interview, Offer, Rejected).
 */

import { callGLM } from "./aiActions"

// ── Base64url decode (Convex runtime has no Node Buffer) ──

function fromBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/")
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

// ── Extract plain-text body from Gmail MIME payload ──

export function extractBody(payload: {
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

// ── Check a single app for replies in its Gmail thread ──

export async function checkReplyForApp(
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

      if (messages.length <= 1) return null

      const replies = messages.filter(
        (msg: { payload?: { headers?: { name: string; value: string }[] } }) => {
          const fromHeader = msg.payload?.headers?.find(
            (h: { name: string }) => h.name.toLowerCase() === "from"
          )
          if (!fromHeader) return false
          const fromValue = fromHeader.value.toLowerCase()
          if (senderEmail && fromValue.includes(senderEmail.toLowerCase())) return false
          return true
        }
      )
      if (replies.length > 0) {
        const latestReply = replies[replies.length - 1]
        const msgId = latestReply.id as string
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

// ── AI classification result ──

export interface ClassificationResult {
  status: "Replied" | "Interview" | "Offer" | "Rejected"
  replySummary: string
  actionNeeded: boolean
  mentionedSalary: number | null
  schedulingLink: string | null
  proposedTimes: string[]
}

// ── Classify a reply email using GLM ──

export async function classifyReply(
  bodyText: string,
  company: string,
  role: string
): Promise<ClassificationResult | null> {
  const glmApiKey = process.env.GLM_API_KEY!

  const classifyPrompt = `You are a highly precise email classifier for a job application agent.

The candidate applied for the role of "${role}" at "${company}".

EMAIL REPLY:
${bodyText.slice(0, 3000)}

Return a JSON object with these EXACT fields:
1. "status" — EXACTLY ONE of: "Replied", "Interview", "Offer", "Rejected"
   - "Interview" — IF the email asks to schedule a call, interview, or availability.
   - "Offer" — IF the email extends a formal or informal job offer.
   - "Rejected" — IF they are not moving forward.
   - "Replied" — Any other general communication.
2. "summary" — A 1-2 sentence plain text summary of the recruiter's message.
3. "actionNeeded" — boolean. true if the candidate needs to respond (e.g. schedule, answer a question).
4. "mentionedSalary" — Extract any annual salary number found. null if none.
5. "schedulingLink" — EXTRACT ANY URL for scheduling (Calendly, HubSpot, etc.). EXTRACT THE FULL URL. null if none.
6. "proposedTimes" — EXTRACT SPECIFIC dates/times mentioned for an interview as an array of strings. [] if none.

CRITICAL: Look very carefully for links and times. If there is a "Schedule an interview" button or link, extract it.
Return ONLY the JSON object.`

  const classificationRaw = await callGLM(classifyPrompt, glmApiKey)
  console.log(`[replyClassifier] AI Raw Output for ${company}:`, classificationRaw)

  let status = ""
  let replySummary = ""
  let actionNeeded = true
  let mentionedSalary: number | null = null
  let schedulingLink: string | null = null
  let proposedTimes: string[] = []
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
      schedulingLink = parsed.schedulingLink || null
      proposedTimes = Array.isArray(parsed.proposedTimes) ? parsed.proposedTimes : []

      console.log(`[replyClassifier] Parsed fields for ${company}:`, {
        status, schedulingLink, proposedTimesCount: proposedTimes.length,
      })
    }
  } catch (err) {
    console.error("[replyClassifier] JSON parse failed:", err)
    status = classificationRaw.trim().replace(/['"]/g, "")
  }

  const validStatuses = ["Replied", "Interview", "Offer", "Rejected"] as const
  const matchedStatus = validStatuses.find(
    (s) => status.toLowerCase() === s.toLowerCase()
  )

  if (!matchedStatus) return null

  return {
    status: matchedStatus,
    replySummary,
    actionNeeded,
    mentionedSalary,
    schedulingLink,
    proposedTimes,
  }
}
