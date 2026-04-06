import { internalAction } from "../_generated/server"
import { internal } from "../_generated/api"
import { v } from "convex/values"
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
      { userId: args.userId, limit: 100, requireEmail: false }
    )

    const botToken = process.env.TELEGRAM_BOT_TOKEN!

    if (topMatches.length === 0) {
      const msg = "No new job matches right now. We'll notify you when we find some!"
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
 * Dispatch top matches to Telegram — called after AI matching.
 * Shows paginated card with Apply/Skip buttons.
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

    const topMatches = await ctx.runQuery(
      internal.sourcing.store.getTopUnnotifiedMatches,
      { userId, limit: 20, requireEmail: false }
    )

    if (topMatches.length === 0) {
      console.log(`No new unnotified matches for ${userId}, skipping dispatch`)
      return 0
    }

    // Send paginated job match card starting at index 0
    // IMPORTANT: Send BEFORE marking as notified so failed sends can be retried
    await ctx.runAction(internal.sourcing.telegramNotify.renderJobMatchPage, {
      userId,
      chatId: link.telegramChatId,
      index: 0,
    })

    // Only mark as notified AFTER successful Telegram send
    await ctx.runMutation(internal.sourcing.store.markAsNotified, {
      matchIds: topMatches.map((m) => m._id),
    })

    console.log(`Dispatched paginated match card to Telegram for ${userId}`)

    return topMatches.length
  },
})
