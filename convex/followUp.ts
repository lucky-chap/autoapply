import { internalAction } from "./_generated/server"
import { internal } from "./_generated/api"
import { Id } from "./_generated/dataModel"
import { callGLM } from "./aiActions"
import { getAuth0ManagementToken, getUserEmail } from "./auth0"

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

// ── Follow-up email generation ──

async function generateFollowUp(
  company: string,
  role: string,
  candidateName: string,
): Promise<string> {
  const apiKey = process.env.GLM_API_KEY!
  return await callGLM(
    `Write a brief, polite follow-up email for a job application.

The candidate "${candidateName}" applied for the role of "${role}" at "${company}" about a week ago and has not heard back.

Requirements:
1. Keep it to 2-3 sentences maximum
2. Be professional but not pushy
3. Politely ask if there are any updates on the position
4. Start with "Dear Hiring Manager," or "Dear ${company} Team,"
5. End with "Best regards," followed by ONLY the candidate's name "${candidateName}"

IMPORTANT: Return ONLY plain text. No markdown formatting.`,
    apiKey,
  )
}

// ── Cron: check for applications needing follow-up ──

export const checkAndSendFollowUps = internalAction({
  args: {},
  handler: async (ctx) => {
    const applications = await ctx.runQuery(
      internal.applications.getApplicationsNeedingFollowUp,
      {}
    )

    if (applications.length === 0) {
      console.log("[follow-up] No applications need follow-up.")
      return
    }

    let managementToken: string
    try {
      managementToken = await getAuth0ManagementToken()
    } catch (err) {
      console.log(`[follow-up] Failed to get management token: ${err}`)
      return
    }

    // Group by user
    const byUser = new Map<string, typeof applications>()
    for (const app of applications) {
      const list = byUser.get(app.userId) ?? []
      list.push(app)
      byUser.set(app.userId, list)
    }

    let totalQueued = 0

    for (const [userId, userApps] of byUser) {
      // Check if user has Telegram linked (needed for approval flow)
      const telegramLink = await ctx.runQuery(
        internal.telegramLinks.getLinkByUserIdInternal,
        { userId }
      )
      if (!telegramLink) continue

      // Get candidate name for the follow-up email
      const userInfo = await getUserEmail(managementToken, userId)
      const candidateName = userInfo?.name ?? "The Candidate"

      for (const app of userApps) {
        // Skip apps without a Gmail thread (can't reply without one)
        if (!app.gmailThreadId) continue

        try {
          const followUpBody = await generateFollowUp(app.company, app.role, candidateName)

          const subject = `Re: Application for ${app.role} at ${app.company}`

          // Create pending action for approval via Telegram
          const pendingActionId = await ctx.runMutation(
            internal.pendingActions.create,
            {
              userId,
              actionType: "send_email" as const,
              payload: {
                to: app.recipientEmail,
                subject,
                body: followUpBody,
                company: app.company,
                role: app.role,
                coverLetter: followUpBody,
              },
              telegramChatId: telegramLink.telegramChatId,
              source: "telegram" as const,
              applicationId: app._id,
            }
          )

          // Mark follow-up as sent (to avoid duplicate pending actions)
          await ctx.runMutation(internal.applications.internalSetFollowUpSent, {
            id: app._id,
          })

          // Send Telegram preview with approval buttons
          const preview = followUpBody.length > 300
            ? followUpBody.slice(0, 300) + "..."
            : followUpBody

          const botToken = process.env.TELEGRAM_BOT_TOKEN!

          const sendTelegramMsg = async (text: string, replyMarkup?: unknown) => {
            const res = await fetch(
              `https://api.telegram.org/bot${botToken}/sendMessage`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: telegramLink.telegramChatId,
                  text,
                  parse_mode: "HTML",
                  ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
                }),
              }
            )
            if (!res.ok) {
              const err = await res.text()
              console.error(`[follow-up] Telegram sendMessage failed: ${err}`)
            }
            return res.json()
          }

          const result = (await sendTelegramMsg(
            `📬 <b>Follow-up ready</b>\n\n` +
              `It's been a week since you applied to <b>${escapeHtml(app.company)}</b> — ${escapeHtml(app.role)}.\n\n` +
              `<b>Follow-up preview:</b>\n${escapeHtml(preview)}`,
            {
              inline_keyboard: [
                [
                  { text: "✅ Send Follow-up", callback_data: `approve:${pendingActionId}` },
                  { text: "❌ Skip", callback_data: `reject:${pendingActionId}` },
                ],
              ],
            }
          )) as { result?: { message_id?: number } }

          if (result?.result?.message_id) {
            await ctx.runMutation(internal.pendingActions.setTelegramMessageId, {
              pendingActionId: pendingActionId as Id<"pendingActions">,
              telegramMessageId: String(result.result.message_id),
            })
          }

          totalQueued++
        } catch (err) {
          console.error(`[follow-up] Failed for app ${app._id}: ${err}`)
        }
      }
    }

    console.log(`[follow-up] Queued ${totalQueued} follow-up approvals.`)
  },
})
