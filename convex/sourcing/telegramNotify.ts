import { internalAction } from "../_generated/server"
import { internal } from "../_generated/api"
import { v } from "convex/values"
import { Id } from "../_generated/dataModel"
import type { ActionCtx } from "../_generated/server"
import {
  escapeHtml,
  sendMessage,
  editMessageText,
} from "../telegramHelpers"

/**
 * Render a single job match page on Telegram (manual mode only).
 * Provides Previous/Next pagination over the user's top pending matches.
 * Only shows jobs that have a recruiter email.
 */
export const renderJobMatchPage = internalAction({
  args: {
    userId: v.string(),
    chatId: v.string(),
    index: v.number(),
    messageId: v.optional(v.number()), // if provided, edits existing message
  },
  handler: async (ctx, args) => {
    const topMatches = await ctx.runQuery(
      internal.sourcing.store.getTopNewMatches,
      { userId: args.userId, limit: 100, requireEmail: true }
    )

    const botToken = process.env.TELEGRAM_BOT_TOKEN!

    if (topMatches.length === 0) {
      const msg = "No new job matches with recruiter emails right now. We'll notify you when we find some!"
      if (args.messageId) {
        await editMessageText(botToken, args.chatId, args.messageId, msg)
      } else {
        await sendMessage(botToken, args.chatId, msg)
      }
      return
    }

    const idx = Math.max(0, Math.min(args.index, topMatches.length - 1))
    const match = topMatches[idx]

    const scoreBadge = match.matchScore
      ? ` (${match.matchScore}% match)`
      : ""

    let msg =
      `<b>Job Match ${idx + 1} of ${topMatches.length}</b>${scoreBadge}\n\n` +
      `<b>${escapeHtml(match.job.title)}</b>\n` +
      `${escapeHtml(match.job.company)}\n` +
      `${escapeHtml(match.job.location)}`

    if (match.job.salary) {
      msg += `\n${escapeHtml(match.job.salary)}`
    }

    if (match.matchReasoning) {
      msg += `\n\n<i>${escapeHtml(match.matchReasoning)}</i>`
    }

    msg += `\n\n<a href="${escapeHtml(match.job.url)}">View listing</a>`

    const buttons = [
      [
        { text: "Apply", callback_data: `job_apply:${match._id}:${idx}` },
        { text: "Skip", callback_data: `job_skip:${match._id}:${idx}` },
      ],
      [] as { text: string; callback_data: string }[]
    ]

    // Pagination buttons
    if (idx > 0) {
      buttons[1].push({ text: "Previous", callback_data: `job_view:${idx - 1}` })
    }
    if (idx < topMatches.length - 1) {
      buttons[1].push({ text: "Next", callback_data: `job_view:${idx + 1}` })
    }

    // Remove empty row if no pagination buttons
    if (buttons[1].length === 0) {
      buttons.pop()
    }

    if (args.messageId) {
      await editMessageText(botToken, args.chatId, args.messageId, msg, { inline_keyboard: buttons })
    } else {
      await sendMessage(botToken, args.chatId, msg, { inline_keyboard: buttons })
    }
  },
})

/**
 * Notify via Telegram that a job was auto-applied.
 */
export const notifyAutoApplied = internalAction({
  args: {
    chatId: v.string(),
    title: v.string(),
    company: v.string(),
    location: v.string(),
    salary: v.optional(v.string()),
    url: v.string(),
    recipientEmail: v.string(),
    matchScore: v.optional(v.number()),
    matchReasoning: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN!

    const scoreBadge = args.matchScore
      ? ` (${args.matchScore}% match)`
      : ""

    let msg =
      `<b>Auto-Applied${scoreBadge}</b>\n\n` +
      `<b>${escapeHtml(args.title)}</b>\n` +
      `${escapeHtml(args.company)}\n` +
      `${escapeHtml(args.location)}`

    if (args.salary) {
      msg += `\n${escapeHtml(args.salary)}`
    }

    if (args.matchReasoning) {
      msg += `\n\n<i>${escapeHtml(args.matchReasoning)}</i>`
    }

    msg += `\n\nSent to: ${escapeHtml(args.recipientEmail)}`
    msg += `\n<a href="${escapeHtml(args.url)}">View listing</a>`

    await sendMessage(botToken, args.chatId, msg)
  },
})

/**
 * Dispatch top matches to Telegram — called after AI matching.
 * In auto mode: only processes jobs with emails, shows job info then auto-applies.
 * In manual mode: shows paginated card with Apply/Skip buttons (email-only jobs).
 * Returns the number of matches dispatched (0 if nothing was sent).
 */
export const dispatchMatchesToTelegram = internalAction({
  args: { userId: v.string() },
  handler: async (ctx, { userId }): Promise<number> => {
    // Get user's Telegram link
    const link = await ctx.runQuery(
      internal.telegramLinks.getLinkByUserIdInternal,
      { userId }
    )
    if (!link) {
      console.log(`No Telegram link for ${userId}, skipping dispatch`)
      return 0
    }

    // Get user settings (autoMode)
    const settings = await ctx.runQuery(
      internal.userSettings.getByUserInternal,
      { userId }
    )

    // Only fetch matches that have recruiter emails
    const topMatches = await ctx.runQuery(
      internal.sourcing.store.getTopUnnotifiedMatches,
      { userId, limit: 20, requireEmail: true }
    )

    if (topMatches.length === 0) {
      console.log(`No new email-bearing matches for ${userId}, skipping dispatch`)
      return 0
    }

    const isAutoMode = settings?.autoMode === true

    // Mark these as notified so they aren't fetched as "unnotified" next cycle
    await ctx.runMutation(internal.sourcing.store.markAsNotified, {
      matchIds: topMatches.map((m) => m._id),
    })

    if (isAutoMode) {
      await handleAutoApply(ctx, userId, link.telegramChatId, topMatches)
    } else {
      // Manual mode: send single job page message starting at index 0
      await ctx.runAction(internal.sourcing.telegramNotify.renderJobMatchPage, {
        userId,
        chatId: link.telegramChatId,
        index: 0,
      })

      console.log(`Dispatched paginated manual match card to Telegram for ${userId}`)
    }

    return topMatches.length
  },
})

// ── Auto-apply helper ──

interface MatchWithJob {
  _id: Id<"userJobMatches">
  userId: string
  jobListingId: Id<"jobListings">
  matchScore?: number
  matchReasoning?: string
  job: {
    title: string
    company: string
    description: string
    url: string
    location: string
    salary?: string
    email?: string
  }
}

async function handleAutoApply(
  ctx: ActionCtx,
  userId: string,
  chatId: string,
  matches: MatchWithJob[]
) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error("GEMINI_API_KEY not set, cannot auto-apply")
    return
  }

  for (const match of matches) {
    try {
      const email = match.job.email
      if (!email) {
        // Should not happen since we filter for email in the query,
        // but skip gracefully if it does
        console.log(`No email for "${match.job.title}" at ${match.job.company}, skipping`)
        continue
      }

      // Generate cover letter
      const coverLetter = await ctx.runAction(
        internal.aiActions.generateCoverLetter,
        {
          jobDescription: match.job.description,
          company: match.job.company,
          role: match.job.title,
          userId,
        }
      )

      const subject = `Application for ${match.job.title} — ${match.job.company}`

      // Create a pending action that is pre-approved
      const pendingActionId = await ctx.runMutation(
        internal.pendingActions.create,
        {
          userId,
          actionType: "send_email" as const,
          payload: {
            to: email,
            subject,
            body: coverLetter,
            company: match.job.company,
            role: match.job.title,
            coverLetter,
          },
          telegramChatId: chatId,
          source: "web" as const,
          attachResume: true,
        }
      )

      // Auto-approve and execute
      await ctx.runMutation(internal.pendingActions.internalApprove, {
        id: pendingActionId,
      })

      // Update match status
      await ctx.runMutation(internal.sourcing.store.updateMatchStatus, {
        matchId: match._id,
        status: "applied",
      })

      // Send Telegram confirmation with full job details
      await ctx.runAction(
        internal.sourcing.telegramNotify.notifyAutoApplied,
        {
          chatId,
          title: match.job.title,
          company: match.job.company,
          location: match.job.location,
          salary: match.job.salary,
          url: match.job.url,
          recipientEmail: email,
          matchScore: match.matchScore,
          matchReasoning: match.matchReasoning,
        }
      )

      console.log(
        `Auto-applied: ${match.job.title} at ${match.job.company} → ${email}`
      )
    } catch (err) {
      console.error(
        `Auto-apply failed for ${match.job.title} at ${match.job.company}:`,
        err
      )
    }
  }
}
