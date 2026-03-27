/**
 * Inbox checker — polls Gmail for replies to active applications.
 *
 * This is a thin orchestrator. Heavy logic is delegated to:
 *   replyClassifier.ts     — Gmail reply detection & AI classification
 *   interviewScheduler.ts  — smart calendar scheduling for interview replies
 */

import { internalAction, ActionCtx } from "./_generated/server"
import { internal } from "./_generated/api"
import { Id } from "./_generated/dataModel"
import { getGmailTokenViaTokenVault, TokenVaultError } from "./tokenVault"
import { getAuth0ManagementToken, getUserEmail } from "./auth0"
import { formatReplyReceived, formatInterviewRequest } from "./openclaw"
import { checkReplyForApp, extractBody, classifyReply } from "./replyClassifier"
import { handleInterviewScheduling } from "./interviewScheduler"

export const checkAllInboxes = internalAction({
  args: {},
  handler: async (ctx) => {
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

    let managementToken: string
    try {
      managementToken = await getAuth0ManagementToken()
    } catch (err) {
      console.log(`[cron] Failed to get management token: ${err}`)
      return
    }

    for (const [userId, userApps] of Array.from(byUser)) {
      let gmailToken: string
      try {
        gmailToken = await getGmailTokenViaTokenVault(ctx, userId)
      } catch (err) {
        console.log(`[cron] Token Vault failed for user ${userId}: ${err}`)
        if (err instanceof TokenVaultError && err.isReauthRequired) {
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

        // ── Classify the reply ──

        const classification = await classifyReply(bodyText, app.company, app.role)
        if (!classification) continue

        const {
          status: matchedStatus, replySummary, actionNeeded,
          mentionedSalary, schedulingLink, proposedTimes,
        } = classification
        const statusChanged = matchedStatus !== app.status

        await ctx.runMutation(
          internal.applications.internalUpdateStatus,
          {
            id: app._id,
            status: statusChanged ? matchedStatus : app.status,
            lastCheckedGmailMsgId: reply.gmailMsgId,
            schedulingLink: schedulingLink || undefined,
            proposedTimes: proposedTimes.length > 0 ? proposedTimes : undefined,
          }
        )
        if (statusChanged) totalUpdated++

        // ── Notify via Telegram ──

        const telegramLink = await ctx.runQuery(
          internal.telegramLinks.getLinkByUserIdInternal,
          { userId: app.userId }
        )
        if (telegramLink) {
          await sendReplyNotification(ctx, {
            app,
            matchedStatus,
            statusChanged,
            replySummary,
            actionNeeded,
            mentionedSalary,
            schedulingLink,
            proposedTimes,
            telegramChatId: telegramLink.telegramChatId,
          })
        }

        // ── OpenClaw notification ──

        const openclawMessage =
          matchedStatus === "Interview"
            ? formatInterviewRequest(app.company, app.role, proposedTimes)
            : formatReplyReceived(app.company, app.role, matchedStatus)
        await ctx.runAction(internal.openclaw.sendNotification, {
          userId: app.userId,
          message: openclawMessage,
        })
      }
    }

    console.log(
      `[cron] Checked ${totalChecked} applications across ${byUser.size} users. Updated ${totalUpdated}.`
    )
  },
})

// ── Build and send the Telegram notification for a reply ──

async function sendReplyNotification(
  ctx: ActionCtx,
  opts: {
    app: {
      _id: string
      userId: string
      company: string
      role: string
      recipientEmail: string
      status?: string
    }
    matchedStatus: "Replied" | "Interview" | "Offer" | "Rejected"
    statusChanged: boolean
    replySummary: string
    actionNeeded: boolean
    mentionedSalary: number | null
    schedulingLink: string | null
    proposedTimes: string[]
    telegramChatId: string
  }
): Promise<void> {
  const {
    app, matchedStatus, statusChanged, replySummary, actionNeeded,
    mentionedSalary, schedulingLink, proposedTimes, telegramChatId,
  } = opts

  const emoji =
    matchedStatus === "Interview" ? "📅" :
    matchedStatus === "Offer" ? "🎉" :
    matchedStatus === "Rejected" ? "😔" : "💬"

  const statusLine = statusChanged
    ? `Status: <b>${matchedStatus}</b> (was ${app.status})`
    : `Status: <b>${matchedStatus}</b>`
  const summaryLine = replySummary ? `\n\n📝 <b>Summary:</b> ${replySummary}` : ""
  const actionLine = actionNeeded
    ? "\n\n👉 <b>Action needed</b> — check your email and respond."
    : "\n\n<i>No action needed on your part.</i>"

  let schedulingAlert = ""
  if (schedulingLink) {
    schedulingAlert = `\n\n📅 <b>Schedule here:</b> ${schedulingLink}`
  }
  if (proposedTimes.length > 0) {
    schedulingAlert += `\n\n⏰ <b>Proposed times:</b>\n- ${proposedTimes.join("\n- ")}`
  }

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

  // ── Smart auto-scheduling for Interview status ──

  let notificationSent = false

  if (matchedStatus === "Interview") {
    try {
      notificationSent = await handleInterviewScheduling(
        ctx,
        {
          _id: app._id as Id<"applications">,
          userId: app.userId,
          company: app.company,
          role: app.role,
          recipientEmail: app.recipientEmail,
        },
        proposedTimes,
        { statusLine, summaryLine, telegramChatId }
      )
    } catch (err) {
      console.error("[inboxChecker] Auto-scheduling failed, falling back:", err)
    }
  }

  // ── Default notification (non-Interview, or scheduling failed) ──

  if (!notificationSent) {
    const replyMarkup =
      (matchedStatus === "Interview" || proposedTimes.length > 0 || schedulingLink)
        ? {
            inline_keyboard: [
              [{ text: "📅 Check My Calendar", callback_data: `cal:${app._id}` }],
            ],
          }
        : undefined

    await ctx.runAction(internal.telegram.sendNotification, {
      chatId: telegramChatId,
      text: `${emoji} <b>${app.company}</b> update for <b>${app.role}</b>\n\n${statusLine}${summaryLine}${salaryAlert}${schedulingAlert}${actionLine}`,
      replyMarkup,
    })
  }
}
