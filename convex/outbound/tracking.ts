import { internalAction } from "../_generated/server"
import { internal } from "../_generated/api"
import { getGmailTokenViaTokenVault, TokenVaultError } from "../tokenVault"
import { extractBody } from "../replyClassifier"
import { escapeHtml, sendMessage } from "../telegramHelpers"

/**
 * Check Gmail threads for replies to outreach emails.
 * Mirrors the pattern from inboxChecker.ts.
 */
export const checkOutreachReplies = internalAction({
  args: {},
  handler: async (ctx) => {
    // Get all "sent" and "opened" outreach messages that have a gmailThreadId
    const activeUsers = await ctx.runQuery(
      internal.sourcing.cron.getActiveUsers
    )

    if (activeUsers.length === 0) return

    let totalChecked = 0
    let totalReplies = 0

    for (const user of activeUsers) {
      const userId = user.userId

      // Collect sent + opened messages for this user
      const sentMessages = await ctx.runQuery(
        internal.outbound.store.getSentMessages,
        { userId }
      )
      const openedMessages = await ctx.runQuery(
        internal.outbound.store.getOpenedMessages,
        { userId }
      )
      const messagesToCheck = [...sentMessages, ...openedMessages].filter(
        (m) => m.gmailThreadId
      )

      if (messagesToCheck.length === 0) continue

      // Get Gmail token
      let gmailToken: string
      try {
        gmailToken = await getGmailTokenViaTokenVault(ctx, userId)
      } catch (err) {
        if (err instanceof TokenVaultError && err.isReauthRequired) {
          console.warn(`[outreach-tracking] Re-auth needed for ${userId}`)
        } else {
          console.error(`[outreach-tracking] Token error for ${userId}:`, err)
        }
        continue
      }

      for (const msg of messagesToCheck) {
        totalChecked++
        try {
          const threadRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/threads/${msg.gmailThreadId}?format=full`,
            { headers: { Authorization: `Bearer ${gmailToken}` } }
          )

          if (!threadRes.ok) continue

          const thread = await threadRes.json()
          const messages = thread.messages ?? []

          // If there are more messages than just the one we sent, there's a reply
          if (messages.length <= 1) continue

          // Check if the latest message is from someone other than us
          const latestMessage = messages[messages.length - 1]
          const fromHeader = latestMessage.payload?.headers?.find(
            (h: { name: string }) => h.name.toLowerCase() === "from"
          )

          // Get the contact's email to verify the reply is from them
          const contact = await ctx.runQuery(
            internal.outbound.store.getContactById,
            { id: msg.contactId }
          )
          if (!contact) continue

          const fromValue = (fromHeader?.value ?? "").toLowerCase()
          if (!fromValue.includes(contact.email.toLowerCase())) continue

          // This is a reply from the contact
          const replyBody = extractBody(latestMessage.payload)
          if (!replyBody.trim()) continue

          await ctx.runMutation(internal.outbound.store.recordMessageReply, {
            id: msg._id,
          })

          totalReplies++

          // Notify via Telegram
          const telegramLink = await ctx.runQuery(
            internal.telegramLinks.getLinkByUserIdInternal,
            { userId }
          )
          if (telegramLink) {
            const contactName =
              `${contact.firstName} ${contact.lastName}`.trim()
            const preview =
              replyBody.length > 200
                ? replyBody.slice(0, 200) + "..."
                : replyBody

            const botToken = process.env.TELEGRAM_BOT_TOKEN!
            await sendMessage(
              botToken,
              telegramLink.telegramChatId,
              `💬 <b>Outreach Reply!</b>\n\n` +
                `<b>${escapeHtml(contactName)}</b>` +
                `${contact.company ? ` at ${escapeHtml(contact.company)}` : ""} replied:\n\n` +
                `<i>${escapeHtml(preview)}</i>`
            )
          }

          console.log(
            `[outreach-tracking] Reply detected from ${contact.email}`
          )
        } catch (err) {
          console.error(
            `[outreach-tracking] Error checking thread ${msg.gmailThreadId}:`,
            err
          )
        }
      }
    }

    if (totalChecked > 0) {
      console.log(
        `[outreach-tracking] Checked ${totalChecked} threads, ${totalReplies} replies found`
      )
    }
  },
})
