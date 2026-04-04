"use node"
import { internalAction } from "./_generated/server"
import { internal } from "./_generated/api"
import { Id } from "./_generated/dataModel"
import { callGemini } from "./aiActions"
import { getAuth0ManagementToken, getUserEmail } from "./auth0"
import { formatFollowUpSent } from "./openclaw"
import { escapeHtml, sendMessage, buildApprovalButtons } from "./telegramHelpers"

// ── Follow-up email generation ──

async function generateFollowUp(
  company: string,
  role: string,
  candidateName: string,
): Promise<string> {
  return await callGemini(
    `Write a brief, polite follow-up email for a job application.

The candidate "${candidateName}" applied for the role of "${role}" at "${company}" about a week ago and has not heard back.

Requirements:
1. Keep it to 2-3 sentences maximum
2. Be professional but not pushy
3. Politely ask if there are any updates on the position
4. Start with "Dear Hiring Manager," or "Dear ${company} Team,"
5. End with "Best regards," followed by ONLY the candidate's name "${candidateName}"

IMPORTANT: Return ONLY plain text. No markdown formatting.`,
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

    for (const [userId, userApps] of Array.from(byUser)) {
      // Check if user has Telegram linked (needed for approval flow)
      const telegramLink = await ctx.runQuery(
        internal.telegramLinks.getLinkByUserIdInternal,
        { userId }
      )
      if (!telegramLink) continue

      // Get candidate name for the follow-up email
      const userInfo = await getUserEmail(managementToken, userId)
      const candidateName = userInfo?.name ?? "The Candidate"

      // Check if user has auto mode enabled
      const userSettings = await ctx.runQuery(
        internal.userSettings.getByUserInternal,
        { userId }
      )
      const isAutoMode = userSettings?.autoMode ?? false

      for (const app of userApps) {
        // Skip apps without a Gmail thread (can't reply without one)
        if (!app.gmailThreadId) continue

        try {
          const followUpBody = await generateFollowUp(app.company, app.role, candidateName)

          const subject = `Re: Application for ${app.role} at ${app.company}`

          // Create pending action
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

          if (isAutoMode) {
            // Auto mode: approve immediately without Telegram preview
            await ctx.runMutation(internal.pendingActions.internalApprove, {
              id: pendingActionId as Id<"pendingActions">,
            })
            // Notify via OpenClaw
            await ctx.runAction(internal.openclaw.sendNotification, {
              userId,
              message: formatFollowUpSent(app.company, app.role),
            })
            totalQueued++
            continue
          }

          // Normal mode: send Telegram preview with approval buttons
          const preview = followUpBody.length > 300
            ? followUpBody.slice(0, 300) + "..."
            : followUpBody

          const botToken = process.env.TELEGRAM_BOT_TOKEN!

          const followUpSiteUrl =
            process.env.NEXT_PUBLIC_CONVEX_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || ""

          const result = (await sendMessage(
            botToken,
            telegramLink.telegramChatId,
            `📬 <b>Follow-up ready</b>\n\n` +
              `It's been a week since you applied to <b>${escapeHtml(app.company)}</b> — ${escapeHtml(app.role)}.\n\n` +
              `<b>Follow-up preview:</b>\n${escapeHtml(preview)}`,
            {
              inline_keyboard: [
                buildApprovalButtons(followUpSiteUrl, pendingActionId as string, { approveLabel: "✅ Send Follow-up" }),
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
