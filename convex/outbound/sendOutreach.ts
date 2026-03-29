import { internalAction } from "../_generated/server"
import { internal } from "../_generated/api"
import { v } from "convex/values"
import { Id } from "../_generated/dataModel"
import { escapeHtml, sendMessage } from "../telegramHelpers"

/**
 * Dispatch a single outreach email through the existing pendingActions pipeline.
 * Follows the exact pattern from followUp.ts:
 *   1. Create pendingAction with outreachMessageId
 *   2. Auto-approve if autoMode, else show Telegram preview
 */
export const dispatchOutreachEmail = internalAction({
  args: {
    outreachMessageId: v.id("outreachMessages"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const msg = await ctx.runQuery(internal.outbound.store.getMessageById, {
      id: args.outreachMessageId,
    })
    if (!msg) {
      console.error(`[outreach] Message ${args.outreachMessageId} not found`)
      return
    }

    const contact = await ctx.runQuery(internal.outbound.store.getContactById, {
      id: msg.contactId,
    })
    if (!contact) {
      console.error(`[outreach] Contact ${msg.contactId} not found`)
      return
    }

    // Get Telegram link
    const telegramLink = await ctx.runQuery(
      internal.telegramLinks.getLinkByUserIdInternal,
      { userId: args.userId }
    )
    if (!telegramLink) {
      console.error(`[outreach] No Telegram link for ${args.userId}`)
      return
    }

    // Get user settings for auto-mode
    const settings = await ctx.runQuery(
      internal.userSettings.getByUserInternal,
      { userId: args.userId }
    )
    const isAutoMode = settings?.autoMode === true

    const contactName = `${contact.firstName} ${contact.lastName}`.trim()

    // Create pending action (reuses existing pipeline)
    const pendingActionId = await ctx.runMutation(
      internal.pendingActions.create,
      {
        userId: args.userId,
        actionType: "send_email" as const,
        payload: {
          to: contact.email,
          subject: msg.subject,
          body: msg.body,
          company: contact.company ?? "Unknown",
          role: contact.jobTitle ?? "Outreach",
          coverLetter: msg.body,
        },
        telegramChatId: telegramLink.telegramChatId,
        source: "telegram" as const,
        outreachMessageId: args.outreachMessageId,
      }
    )

    // Link the pending action to the outreach message
    await ctx.runMutation(internal.outbound.store.updateMessageStatus, {
      id: args.outreachMessageId,
      status: "pending_approval",
      pendingActionId: pendingActionId as Id<"pendingActions">,
    })

    if (isAutoMode) {
      await ctx.runMutation(internal.pendingActions.internalApprove, {
        id: pendingActionId as Id<"pendingActions">,
      })
      console.log(
        `[outreach] Auto-approved email to ${contactName} (${contact.email})`
      )
    } else {
      // Manual mode: send Telegram preview with approve/reject buttons
      const botToken = process.env.TELEGRAM_BOT_TOKEN!
      const preview =
        msg.body.length > 300 ? msg.body.slice(0, 300) + "..." : msg.body

      const result = (await sendMessage(
        botToken,
        telegramLink.telegramChatId,
        `📧 <b>Outreach ready</b>\n\n` +
          `To: <b>${escapeHtml(contactName)}</b> (${escapeHtml(contact.email)})\n` +
          `${contact.company ? `Company: ${escapeHtml(contact.company)}\n` : ""}` +
          `Subject: ${escapeHtml(msg.subject)}\n\n` +
          `<b>Preview:</b>\n${escapeHtml(preview)}`,
        {
          inline_keyboard: [
            [
              {
                text: "✅ Send",
                callback_data: `outreach_approve:${pendingActionId}`,
              },
              {
                text: "❌ Skip",
                callback_data: `outreach_reject:${pendingActionId}`,
              },
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

      console.log(
        `[outreach] Sent approval request for ${contactName} (${contact.email})`
      )
    }
  },
})
