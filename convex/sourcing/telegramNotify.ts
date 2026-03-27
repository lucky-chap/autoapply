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
 * Render a single job match page on Telegram.
 * Provides Previous/Next pagination over the user's top pending matches.
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
      { userId: args.userId, limit: 100 }
    )

    const botToken = process.env.TELEGRAM_BOT_TOKEN!

    if (topMatches.length === 0) {
      const msg = "🎉 <b>All caught up!</b> You've reviewed all your daily matches."
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
      `🔍 <b>Job Match ${idx + 1} of ${topMatches.length}</b>${scoreBadge}\n\n` +
      `<b>${escapeHtml(match.job.title)}</b>\n` +
      `🏢 ${escapeHtml(match.job.company)}\n` +
      `📍 ${escapeHtml(match.job.location)}`

    if (match.job.salary) {
      msg += `\n💰 ${escapeHtml(match.job.salary)}`
    }

    if (match.matchReasoning) {
      msg += `\n\n<i>${escapeHtml(match.matchReasoning)}</i>`
    }

    msg += `\n\n🔗 <a href="${escapeHtml(match.job.url)}">View listing</a>`

    const buttons = [
      [
        { text: "✅ Apply", callback_data: `job_apply:${match._id}:${idx}` },
        { text: "❌ Skip", callback_data: `job_skip:${match._id}:${idx}` },
      ],
      [] as { text: string; callback_data: string }[]
    ]

    // Pagination buttons
    if (idx > 0) {
      buttons[1].push({ text: "⬅️ Previous", callback_data: `job_view:${idx - 1}` })
    }
    if (idx < topMatches.length - 1) {
      buttons[1].push({ text: "⏭ Next", callback_data: `job_view:${idx + 1}` })
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
    recipientEmail: v.string(),
    matchScore: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN!

    const scoreBadge = args.matchScore
      ? ` (${args.matchScore}% match)`
      : ""

    const msg =
      `🤖 <b>Auto-Applied${scoreBadge}</b>\n\n` +
      `<b>${escapeHtml(args.title)}</b>\n` +
      `🏢 ${escapeHtml(args.company)}\n` +
      `📬 Sent to: ${escapeHtml(args.recipientEmail)}\n\n` +
      `<i>This was sent automatically because auto-mode is enabled.</i>`

    await sendMessage(botToken, args.chatId, msg)
  },
})

/**
 * Dispatch top matches to Telegram — called after AI matching.
 * Routes to manual approval or auto-apply based on user's autoMode setting.
 */
export const dispatchMatchesToTelegram = internalAction({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    // Get user's Telegram link
    const link = await ctx.runQuery(
      internal.telegramLinks.getLinkByUserIdInternal,
      { userId }
    )
    if (!link) {
      console.log(`No Telegram link for ${userId}, skipping dispatch`)
      return
    }

    // Get user settings (autoMode)
    const settings = await ctx.runQuery(
      internal.userSettings.getByUserInternal,
      { userId }
    )

    // Get top 3 new matches
    const topMatches = await ctx.runQuery(
      internal.sourcing.store.getTopNewMatches,
      { userId, limit: 3 }
    )

    if (topMatches.length === 0) {
      console.log(`No new matches for ${userId}, skipping dispatch`)
      return
    }

    const isAutoMode = settings?.autoMode === true

    if (isAutoMode) {
      // Auto-apply mode: generate cover letter + send email for each
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
      // Try to extract an email from the job description
      const emailResult = await ctx.runAction(
        internal.aiActions.extractJobInfo,
        { jobDescription: match.job.description }
      )

      if (!emailResult.email) {
        // No email found — send as manual card instead
        console.log(
          `No email found for "${match.job.title}" at ${match.job.company}, falling back to manual`
        )
        await ctx.runAction(
          internal.sourcing.telegramNotify.renderJobMatchPage,
          {
            userId,
            chatId,
            index: 0,
          }
        )
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
            to: emailResult.email,
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

      // Send Telegram confirmation
      await ctx.runAction(
        internal.sourcing.telegramNotify.notifyAutoApplied,
        {
          chatId,
          title: match.job.title,
          company: match.job.company,
          recipientEmail: emailResult.email,
          matchScore: match.matchScore,
        }
      )

      console.log(
        `Auto-applied: ${match.job.title} at ${match.job.company} → ${emailResult.email}`
      )
    } catch (err) {
      console.error(
        `Auto-apply failed for ${match.job.title} at ${match.job.company}:`,
        err
      )
    }
  }
}
