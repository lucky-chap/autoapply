/**
 * Telegram bot entry points — thin orchestrator.
 *
 * This file defines the Convex actions that are referenced by other modules
 * (http.ts, pendingActions.ts, crons.ts, etc). All heavy logic is delegated
 * to helper modules:
 *
 *   telegramHelpers.ts   — API wrappers, email encoding, escaping
 *   telegramCommands.ts  — /start, /link, /unlink, /salary, /auto, /clear, /status, /job
 *   telegramCallbacks.ts — inline-keyboard button handlers
 *   telegramJobFlow.ts   — job description processing & application creation
 */

"use node"
import { internalAction, internalMutation } from "./_generated/server"
import { internal } from "./_generated/api"
import { v } from "convex/values"
import { Id } from "./_generated/dataModel"
import { getGmailTokenViaTokenVault, TokenVaultError } from "./tokenVault"
import { getAuth0ManagementToken, getUserEmail } from "./auth0"
import { formatApplicationSent } from "./openclaw"
import {
  escapeHtml,
  sendMessage,
  editMessageReplyMarkup,
  encodeEmail,
  Attachment,
} from "./telegramHelpers"
import {
  handleStart,
  handleLink,
  handleUnlink,
  handleSalary,
  handleAuto,
  handleClear,
  handleStatus,
  handleJob,
  handleLinks,
} from "./telegramCommands"
import { handleCallbackQuery } from "./telegramCallbacks"
import {
  processJobDescription,
  continueWithApplication,
} from "./telegramJobFlow"

// ── Main webhook handler ──

export const processUpdate = internalAction({
  args: { update: v.string() },
  handler: async (ctx, { update }) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN!
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_CONVEX_SITE_URL ||
      ""
    const parsed = JSON.parse(update)

    // Deduplicate
    const updateId = parsed.update_id as number | undefined
    if (updateId != null) {
      const isDuplicate = await ctx.runMutation(
        internal.telegramLinks.checkAndMarkUpdate,
        { updateId }
      )
      if (isDuplicate) {
        console.log(`[telegram] Skipping duplicate update_id=${updateId}`)
        return
      }
    }

    // Callback queries (button presses)
    if (parsed.callback_query) {
      await handleCallbackQuery(ctx, botToken, parsed.callback_query)
      return
    }

    const message = parsed.message
    if (!message?.text) return

    const chatId = String(message.chat.id)
    const text = message.text.trim()

    // ── Route commands ──

    if (text === "/start" || text.startsWith("/start ")) {
      const deepLinkToken = text.startsWith("/start ")
        ? text.slice(7).trim()
        : undefined
      await handleStart(ctx, botToken, chatId, siteUrl, deepLinkToken)
      return
    }

    if (text === "/link") {
      await handleLink(ctx, botToken, chatId, siteUrl)
      return
    }

    if (text === "/unlink") {
      await handleUnlink(ctx, botToken, chatId)
      return
    }

    if (text.startsWith("/salary")) {
      const link = await ctx.runQuery(
        internal.telegramLinks.getLinkByTelegramChatId,
        { telegramChatId: chatId }
      )
      if (!link) {
        await sendMessage(
          botToken,
          chatId,
          "⚠️ Account not linked. Use /link first."
        )
        return
      }
      await handleSalary(ctx, botToken, chatId, text, link.userId)
      return
    }

    if (text === "/auto") {
      const link = await ctx.runQuery(
        internal.telegramLinks.getLinkByTelegramChatId,
        { telegramChatId: chatId }
      )
      if (!link) {
        await sendMessage(
          botToken,
          chatId,
          "⚠️ Account not linked. Use /link first."
        )
        return
      }
      await handleAuto(ctx, botToken, chatId, link.userId)
      return
    }

    if (text === "/clear") {
      const link = await ctx.runQuery(
        internal.telegramLinks.getLinkByTelegramChatId,
        { telegramChatId: chatId }
      )
      await handleClear(ctx, botToken, chatId, link?.userId)
      return
    }

    if (text === "/status") {
      const link = await ctx.runQuery(
        internal.telegramLinks.getLinkByTelegramChatId,
        { telegramChatId: chatId }
      )
      if (!link) {
        await sendMessage(
          botToken,
          chatId,
          "⚠️ Account not linked. Use /link first."
        )
        return
      }
      await handleStatus(ctx, botToken, chatId, link.userId, siteUrl)
      return
    }

    if (text.startsWith("/links")) {
      const link = await ctx.runQuery(
        internal.telegramLinks.getLinkByTelegramChatId,
        { telegramChatId: chatId }
      )
      if (!link) {
        await sendMessage(
          botToken,
          chatId,
          "⚠️ Account not linked. Use /link first."
        )
        return
      }
      await handleLinks(ctx, botToken, chatId, text, link.userId)
      return
    }

    if (text === "/job") {
      const link = await ctx.runQuery(
        internal.telegramLinks.getLinkByTelegramChatId,
        { telegramChatId: chatId }
      )
      if (!link) {
        await sendMessage(
          botToken,
          chatId,
          "⚠️ Your Telegram account is not linked yet.\n\nUse /link to connect your AutoApply account first."
        )
        return
      }
      await handleJob(ctx, botToken, chatId)
      return
    }

    // ── Non-command text ──

    const link = await ctx.runQuery(
      internal.telegramLinks.getLinkByTelegramChatId,
      { telegramChatId: chatId }
    )
    if (!link) {
      await sendMessage(
        botToken,
        chatId,
        "⚠️ Your Telegram account is not linked yet.\n\nUse /link to connect your AutoApply account first."
      )
      return
    }

    // Check if user is replying with an email for a previous posting
    const pendingInput = await ctx.runQuery(
      internal.telegramLinks.getPendingEmailInput,
      { telegramChatId: chatId }
    )
    if (pendingInput) {
      const emailMatch = text.match(/^[\w.+-]+@[\w.-]+\.\w{2,}$/)
      if (emailMatch) {
        await ctx.runMutation(internal.telegramLinks.deletePendingEmailInput, {
          telegramChatId: chatId,
        })
        await sendMessage(
          botToken,
          chatId,
          "⏳ Generating your cover letter..."
        )
        await continueWithApplication(
          ctx,
          botToken,
          chatId,
          link.userId,
          pendingInput.jobDescription,
          pendingInput.company,
          pendingInput.role,
          emailMatch[0]
        )
        return
      } else {
        await ctx.runMutation(internal.telegramLinks.deletePendingEmailInput, {
          telegramChatId: chatId,
        })
      }
    }

    // Check if user is in job input mode
    const jobMode = await ctx.runQuery(internal.telegramLinks.getJobInputMode, {
      telegramChatId: chatId,
    })
    if (jobMode) {
      await ctx.runMutation(internal.telegramLinks.clearJobInputMode, {
        telegramChatId: chatId,
      })
      const { isFirst } = await ctx.runMutation(
        internal.telegramLinks.appendToMessageBuffer,
        { telegramChatId: chatId, text }
      )
      if (isFirst) {
        await sendMessage(botToken, chatId, "⏳ Receiving your message...")
        await ctx.scheduler.runAfter(
          3000,
          internal.telegram.processBufferedMessage,
          { telegramChatId: chatId, userId: link.userId }
        )
      }
      return
    }

    // No active mode — show help
    await sendMessage(
      botToken,
      chatId,
      "💡 Use a command to get started:\n\n" +
        "/job — Paste a job description with a recruiter email\n" +
        "/status — Check recent applications\n" +
        "/salary — Set minimum salary alert\n" +
        "/auto — Toggle auto mode\n" +
        "/clear — Clear chat state\n\n" +
        "<i>Send /job first, then paste your job description.</i>"
    )
  },
})

// ── Buffered message processor (debounced) ──

export const processBufferedMessage = internalAction({
  args: {
    telegramChatId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, { telegramChatId, userId }) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN!

    const buf = await ctx.runQuery(internal.telegramLinks.getMessageBuffer, {
      telegramChatId,
    })
    if (!buf) return

    if (Date.now() - buf.lastMessageAt < 2000) {
      await ctx.scheduler.runAfter(
        2000,
        internal.telegram.processBufferedMessage,
        { telegramChatId, userId }
      )
      return
    }

    const fullText: string | null = await ctx.runMutation(
      internal.telegramLinks.consumeMessageBuffer,
      { telegramChatId }
    )
    if (!fullText) return

    await processJobDescription(ctx, botToken, telegramChatId, userId, fullText)
  },
})

// ── Execute approved action (send email via Gmail) ──

export const executeApprovedAction = internalAction({
  args: { pendingActionId: v.id("pendingActions") },
  handler: async (ctx, { pendingActionId }) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN!
    const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL

    const action = await ctx.runQuery(internal.pendingActions.getById, {
      id: pendingActionId,
    })
    if (!action || action.status !== "approved") {
      console.error(
        "[telegram] Action not found or not approved:",
        pendingActionId
      )
      return
    }

    try {
      const gmailToken = await getGmailTokenViaTokenVault(ctx, action.userId)
      const managementToken = await getAuth0ManagementToken()
      const senderInfo = await getUserEmail(managementToken, action.userId)

      const isFollowUp = !!action.applicationId

      let applicationId: Id<"applications">
      let gmailThreadId: string | undefined
      if (isFollowUp) {
        applicationId = action.applicationId!
        const existingApp = await ctx.runQuery(
          internal.applications.internalGetById,
          { id: applicationId }
        )
        gmailThreadId = existingApp?.gmailThreadId
      } else {
        applicationId = await ctx.runMutation(
          internal.applications.internalCreate,
          {
            userId: action.userId,
            company: action.payload.company,
            role: action.payload.role,
            coverLetter: action.payload.coverLetter,
            recipientEmail: action.payload.to,
            source: "telegram" as const,
            ...(action.jobListingId
              ? { jobListingId: action.jobListingId }
              : {}),
          }
        )
      }

      // Tracking pixel
      const trackingPixelUrl = convexSiteUrl
        ? `${convexSiteUrl}/track/open?id=${applicationId}`
        : undefined

      // Fetch resume if requested
      const attachments: Attachment[] = []
      if (action.attachResume) {
        const profile = await ctx.runQuery(
          internal.resumeProfiles.getByUserInternal,
          { userId: action.userId }
        )
        if (profile?.fileId) {
          const fileUrl = await ctx.storage.getUrl(profile.fileId)
          if (fileUrl) {
            const fileRes = await fetch(fileUrl)
            if (fileRes.ok) {
              const arrayBuf = await fileRes.arrayBuffer()
              const contentType =
                fileRes.headers.get("content-type") || "application/pdf"
              const ext = contentType.includes("pdf") ? "pdf" : "docx"
              const name = senderInfo
                ? `${senderInfo.name.replace(/\s+/g, "_")}_Resume.${ext}`
                : `Resume.${ext}`
              attachments.push({
                filename: name,
                mimeType: contentType,
                data: new Uint8Array(arrayBuf),
              })
            }
          }
        }
      }

      // Encode and send email
      const encodedEmail = encodeEmail({
        to: action.payload.to,
        subject: action.payload.subject,
        body: action.payload.body,
        from: senderInfo ?? undefined,
        trackingPixelUrl,
        attachments: attachments.length > 0 ? attachments : undefined,
      })

      const gmailBody: { raw: string; threadId?: string } = {
        raw: encodedEmail,
      }
      if (gmailThreadId) gmailBody.threadId = gmailThreadId

      const gmailRes = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${gmailToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(gmailBody),
        }
      )

      if (!gmailRes.ok) {
        const err = await gmailRes.json()
        throw new Error(`Gmail send failed: ${JSON.stringify(err)}`)
      }

      const gmailResult = await gmailRes.json()

      if (!isFollowUp && gmailResult.threadId) {
        try {
          await ctx.runMutation(internal.applications.internalSetThreadId, {
            id: applicationId,
            gmailThreadId: gmailResult.threadId,
          })
        } catch {
          // Non-critical
        }
      }

      await ctx.runMutation(internal.pendingActions.updateStatus, {
        id: pendingActionId,
        status: "executed",
        applicationId,
      })

      // Notify user via Telegram
      if (action.telegramChatId) {
        const notifyText = isFollowUp
          ? `📬 <b>Follow-up sent!</b>\n\n` +
            `<b>${escapeHtml(action.payload.company)}</b> — ${escapeHtml(action.payload.role)}\n` +
            `📬 Sent to: ${escapeHtml(action.payload.to)}`
          : `🎉 <b>Application sent!</b>\n\n` +
            `<b>${escapeHtml(action.payload.company)}</b> — ${escapeHtml(action.payload.role)}\n` +
            `📬 Sent to: ${escapeHtml(action.payload.to)}\n\n` +
            `<i>I'll notify you when they reply.</i>`
        await sendMessage(botToken, action.telegramChatId, notifyText)
      }

      // Notify via OpenClaw
      await ctx.runAction(internal.openclaw.sendNotification, {
        userId: action.userId,
        message: formatApplicationSent(
          action.payload.company,
          action.payload.role
        ),
      })
    } catch (err) {
      await ctx.runMutation(internal.pendingActions.updateStatus, {
        id: pendingActionId,
        status: "failed",
        error: String(err),
      })

      if (action.telegramChatId) {
        const siteUrl = process.env.APP_BASE_URL || "the web app"
        const isTokenError =
          err instanceof TokenVaultError && err.isReauthRequired

        if (isTokenError) {
          await sendMessage(
            botToken,
            action.telegramChatId,
            `🔑 <b>Re-authorization required</b>\n\n` +
              `Your Google session has expired. Please visit the dashboard to refresh your session:\n` +
              `${escapeHtml(siteUrl)}/dashboard\n\n` +
              `After logging in, your token will sync automatically. Then retry here.`,
            {
              inline_keyboard: [
                [
                  {
                    text: "🔄 Retry",
                    callback_data: `retry:${pendingActionId}`,
                  },
                ],
              ],
            }
          )
        } else {
          await sendMessage(
            botToken,
            action.telegramChatId,
            `⚠️ <b>Failed to send application</b>\n\n` +
              `${escapeHtml(action.payload.company)} — ${escapeHtml(action.payload.role)}\n` +
              `Error: ${escapeHtml(String(err))}`,
            {
              inline_keyboard: [
                [
                  {
                    text: "🔄 Retry",
                    callback_data: `retry:${pendingActionId}`,
                  },
                ],
              ],
            }
          )
        }
      }
    }
  },
})

// ── Send notification (called from other modules) ──

export const sendNotification = internalAction({
  args: {
    chatId: v.string(),
    text: v.string(),
    replyMarkup: v.optional(v.any()),
  },
  handler: async (_ctx, { chatId, text, replyMarkup }) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN!
    return await sendMessage(botToken, chatId, text, replyMarkup)
  },
})

// ── Clear inline keyboard from a message (called after approval via link) ──

export const clearTelegramKeyboard = internalAction({
  args: {
    chatId: v.string(),
    messageId: v.number(),
  },
  handler: async (_ctx, { chatId, messageId }) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN!
    await editMessageReplyMarkup(botToken, chatId, messageId)
  },
})
