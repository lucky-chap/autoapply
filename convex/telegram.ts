import { internalAction, ActionCtx } from "./_generated/server"
import { internal } from "./_generated/api"
import { v } from "convex/values"
import { Id } from "./_generated/dataModel"
import { extractJobInfoHelper, generateCoverLetterHelper } from "./aiActions"
import {
  getGmailTokenViaTokenVault,
  getAuth0ManagementToken,
  getUserEmail,
} from "./tokenVault"

// ── Telegram Bot API helpers ──

async function sendTelegram(
  botToken: string,
  method: string,
  body: Record<string, unknown>
): Promise<unknown> {
  const res = await fetch(
    `https://api.telegram.org/bot${botToken}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  )
  if (!res.ok) {
    const err = await res.text()
    console.error(`[telegram] ${method} failed: ${err}`)
  }
  return res.json()
}

async function sendMessage(
  botToken: string,
  chatId: string,
  text: string,
  replyMarkup?: unknown
) {
  return sendTelegram(botToken, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  })
}

async function editMessageReplyMarkup(
  botToken: string,
  chatId: string,
  messageId: number
) {
  return sendTelegram(botToken, "editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: [] },
  })
}

async function answerCallbackQuery(botToken: string, callbackQueryId: string, text: string) {
  return sendTelegram(botToken, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
  })
}

// ── Base64 helpers (Convex runtime has no Node Buffer) ──

function toBase64(str: string): string {
  return btoa(
    Array.from(new TextEncoder().encode(str), (b) => String.fromCharCode(b)).join("")
  )
}

function toBase64Url(str: string): string {
  return toBase64(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

// ── Email encoding (same logic as lib/gmail.ts) ──

function encodeSubject(subject: string): string {
  if (/[^\x20-\x7E]/.test(subject)) {
    return `=?UTF-8?B?${toBase64(subject)}?=`
  }
  return subject
}

function encodeEmail({
  to,
  subject,
  body,
  from,
  trackingPixelUrl,
}: {
  to: string
  subject: string
  body: string
  from?: { name: string; email: string }
  trackingPixelUrl?: string
}): string {
  const encodedSubject = encodeSubject(subject)
  const fromHeader = from ? `From: ${from.name} <${from.email}>` : ""

  const headers = [
    ...(fromHeader ? [fromHeader] : []),
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
  ]

  if (!trackingPixelUrl) {
    const rawEmail = [
      ...headers,
      `Content-Type: text/plain; charset="UTF-8"`,
      "",
      body,
    ].join("\n")
    return toBase64Url(rawEmail)
  }

  const boundary = "----autoapply_boundary"
  const htmlBody = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>")

  const rawEmail = [
    ...headers,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    "",
    body,
    "",
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    "",
    `<html><body><div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#333">${htmlBody}</div><img src="${trackingPixelUrl}" width="1" height="1" style="display:none" alt="" /></body></html>`,
    "",
    `--${boundary}--`,
  ].join("\n")

  return toBase64Url(rawEmail)
}

// ── Helper: create pending action and send preview ──

async function createPendingActionAndPreview(
  ctx: ActionCtx,
  botToken: string,
  chatId: string,
  userId: string,
  payload: {
    to: string
    subject: string
    body: string
    company: string
    role: string
    coverLetter: string
  }
) {
  const pendingActionId = await ctx.runMutation(internal.pendingActions.create, {
    userId,
    actionType: "send_email" as const,
    payload,
    telegramChatId: chatId,
    source: "telegram" as const,
  })

  const preview = payload.coverLetter.length > 500
    ? payload.coverLetter.slice(0, 500) + "..."
    : payload.coverLetter

  const result = await sendMessage(
    botToken,
    chatId,
    `📧 *Ready to send application*\n\n` +
      `*Company:* ${payload.company}\n` +
      `*Role:* ${payload.role}\n` +
      `*To:* ${payload.to}\n\n` +
      `*Cover Letter Preview:*\n${preview}`,
    {
      inline_keyboard: [
        [
          { text: "✅ Approve & Send", callback_data: `approve:${pendingActionId}` },
          { text: "❌ Reject", callback_data: `reject:${pendingActionId}` },
        ],
      ],
    }
  ) as { result?: { message_id?: number } }

  if (result?.result?.message_id) {
    await ctx.runMutation(internal.pendingActions.setTelegramMessageId, {
      pendingActionId: pendingActionId as Id<"pendingActions">,
      telegramMessageId: String(result.result.message_id),
    })
  }
}

// ── Main webhook handler ──

export const processUpdate = internalAction({
  args: { update: v.string() },
  handler: async (ctx, { update }) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN!
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_CONVEX_SITE_URL || ""
    const parsed = JSON.parse(update)

    // Deduplicate — Telegram may deliver the same update multiple times
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

    // Handle callback queries (button presses)
    if (parsed.callback_query) {
      await handleCallbackQuery(ctx, botToken, parsed.callback_query)
      return
    }

    const message = parsed.message
    if (!message?.text) return

    const chatId = String(message.chat.id)
    const text = message.text.trim()

    // Command: /start
    if (text === "/start") {
      const existingLink = await ctx.runQuery(
        internal.telegramLinks.getLinkByTelegramChatId,
        { telegramChatId: chatId }
      )
      let greeting = "👋 *Welcome to AutoApply Bot!*\n\n"
      if (existingLink) {
        try {
          const mgmtToken = await getAuth0ManagementToken()
          const userInfo = await getUserEmail(mgmtToken, existingLink.userId)
          if (userInfo) {
            greeting += `✅ Logged in as *${userInfo.name}* (${userInfo.email})\n\n`
          }
        } catch { /* non-critical */ }
      }
      await sendMessage(
        botToken,
        chatId,
        greeting +
          "I can help you apply to jobs directly from Telegram.\n\n" +
          "1️⃣ First, link your account: /link\n" +
          "2️⃣ Then send me a job description and I'll generate a cover letter\n" +
          "3️⃣ Approve the send with one tap\n\n" +
          "Commands:\n" +
          "/link — Link your AutoApply account\n" +
          "/status — Check your recent applications"
      )
      return
    }

    // Command: /link
    if (text === "/link") {
      const code = generateCode()
      await ctx.runMutation(internal.telegramLinks.createLinkingCode, {
        code,
        telegramChatId: chatId,
      })
      const linkUrl = `${siteUrl}/api/telegram/link?code=${code}`
      await sendMessage(
        botToken,
        chatId,
        "🔗 *Link your AutoApply account*\n\n" +
          `Open this link while logged in to AutoApply:\n${linkUrl}\n\n` +
          "_This link expires in 15 minutes._"
      )
      return
    }

    // Command: /status
    if (text === "/status") {
      const link = await ctx.runQuery(
        internal.telegramLinks.getLinkByTelegramChatId,
        { telegramChatId: chatId }
      )
      if (!link) {
        await sendMessage(botToken, chatId, "⚠️ Account not linked. Use /link first.")
        return
      }

      const recent = await ctx.runQuery(
        internal.applications.getRecentByUserInternal,
        { userId: link.userId, limit: 5 }
      )

      if (recent.length === 0) {
        await sendMessage(botToken, chatId, "📊 No applications yet. Send me a job description to get started!")
        return
      }

      const statusEmoji: Record<string, string> = {
        Applied: "📤",
        Replied: "💬",
        Interview: "🎤",
        Offer: "🎉",
        Rejected: "❌",
      }

      const lines = recent.map((app) => {
        const emoji = statusEmoji[app.status ?? "Applied"] ?? "📤"
        const date = new Date(app.emailSentAt ?? app.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
        const opens = app.openCount ? ` · ${app.openCount} open${app.openCount > 1 ? "s" : ""}` : ""
        return `${emoji} *${app.company}* — ${app.role}\n    ${app.status ?? "Applied"} · ${date}${opens}`
      })

      await sendMessage(
        botToken,
        chatId,
        `📊 *Recent Applications*\n\n${lines.join("\n\n")}\n\n` +
          `View all on the dashboard:\n${siteUrl}/dashboard`
      )
      return
    }

    // Otherwise, treat as a job description (or email follow-up)
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

    // Check if user is replying with an email address for a previous job posting
    const pendingInput = await ctx.runQuery(
      internal.telegramLinks.getPendingEmailInput,
      { telegramChatId: chatId }
    )
    if (pendingInput) {
      const emailMatch = text.match(/^[\w.+-]+@[\w.-]+\.\w{2,}$/)
      if (emailMatch) {
        // User provided the missing email — delete pending state and continue
        await ctx.runMutation(internal.telegramLinks.deletePendingEmailInput, {
          telegramChatId: chatId,
        })
        await sendMessage(botToken, chatId, "⏳ Generating your cover letter...")

        let coverLetter: string
        try {
          coverLetter = await generateCoverLetterHelper(
            ctx,
            pendingInput.jobDescription,
            pendingInput.company,
            pendingInput.role,
            link.userId,
          )
        } catch (err) {
          await sendMessage(botToken, chatId, `❌ Failed to generate cover letter: ${String(err)}`)
          return
        }

        const email = emailMatch[0]
        const subject = `Application for ${pendingInput.role} at ${pendingInput.company}`

        // Jump to the pending action creation (shared with normal flow below)
        await createPendingActionAndPreview(ctx, botToken, chatId, link.userId, {
          to: email,
          subject,
          body: coverLetter,
          company: pendingInput.company,
          role: pendingInput.role,
          coverLetter,
        })
        return
      } else {
        // Not an email — clear the pending state and treat as a new job description
        await ctx.runMutation(internal.telegramLinks.deletePendingEmailInput, {
          telegramChatId: chatId,
        })
      }
    }

    await sendMessage(botToken, chatId, "⏳ Processing your job description...")

    // Extract job info
    let jobInfo: { company: string; role: string; email: string }
    try {
      jobInfo = await extractJobInfoHelper(text)
    } catch (err) {
      console.error("[telegram] extractJobInfo failed:", err)
      await sendMessage(
        botToken,
        chatId,
        `❌ Failed to process job description: ${String(err)}`
      )
      return
    }

    if (!jobInfo.company && !jobInfo.role) {
      await sendMessage(
        botToken,
        chatId,
        "❌ I couldn't extract job details from that text. Please send a full job description or posting."
      )
      return
    }

    if (!jobInfo.email) {
      // Save state so the next message can provide the email
      await ctx.runMutation(internal.telegramLinks.savePendingEmailInput, {
        telegramChatId: chatId,
        jobDescription: text,
        company: jobInfo.company,
        role: jobInfo.role,
      })
      await sendMessage(
        botToken,
        chatId,
        `📝 Found: *${jobInfo.company}* — *${jobInfo.role}*\n\n` +
          "⚠️ No contact email found in the posting. Please reply with the recruiter's email address."
      )
      return
    }

    // Generate cover letter
    let coverLetter: string
    try {
      coverLetter = await generateCoverLetterHelper(
        ctx,
        text,
        jobInfo.company,
        jobInfo.role,
        link.userId,
      )
    } catch (err) {
      await sendMessage(
        botToken,
        chatId,
        `❌ Failed to generate cover letter: ${String(err)}`
      )
      return
    }

    const subject = `Application for ${jobInfo.role} at ${jobInfo.company}`

    await createPendingActionAndPreview(ctx, botToken, chatId, link.userId, {
      to: jobInfo.email,
      subject,
      body: coverLetter,
      company: jobInfo.company,
      role: jobInfo.role,
      coverLetter,
    })
  },
})

// ── Callback query handler ──

async function handleCallbackQuery(
  ctx: ActionCtx,
  botToken: string,
  callbackQuery: {
    id: string
    data?: string
    message?: { chat: { id: number }; message_id: number }
  }
) {
  const data = callbackQuery.data
  if (!data) return

  const chatId = String(callbackQuery.message?.chat.id)
  const messageId = callbackQuery.message?.message_id

  if (data.startsWith("approve:")) {
    const actionId = data.replace("approve:", "") as Id<"pendingActions">
    try {
      await ctx.runMutation(internal.pendingActions.internalApprove, {
        id: actionId,
      })
      await answerCallbackQuery(botToken, callbackQuery.id, "Approved! Sending email...")
      if (messageId) {
        await editMessageReplyMarkup(botToken, chatId, messageId)
      }
      await sendMessage(botToken, chatId, "✅ *Approved!* Sending your application now...")
    } catch (err) {
      await answerCallbackQuery(botToken, callbackQuery.id, `Error: ${String(err)}`)
    }
  } else if (data.startsWith("reject:")) {
    const actionId = data.replace("reject:", "") as Id<"pendingActions">
    try {
      await ctx.runMutation(internal.pendingActions.internalReject, {
        id: actionId,
      })
      await answerCallbackQuery(botToken, callbackQuery.id, "Rejected.")
      if (messageId) {
        await editMessageReplyMarkup(botToken, chatId, messageId)
      }
      await sendMessage(botToken, chatId, "❌ Application rejected. The email was not sent.")
    } catch (err) {
      await answerCallbackQuery(botToken, callbackQuery.id, `Error: ${String(err)}`)
    }
  } else if (data.startsWith("retry:")) {
    const actionId = data.replace("retry:", "") as Id<"pendingActions">
    try {
      await ctx.runMutation(internal.pendingActions.retryFailed, {
        id: actionId,
      })
      await answerCallbackQuery(botToken, callbackQuery.id, "Retrying...")
      if (messageId) {
        await editMessageReplyMarkup(botToken, chatId, messageId)
      }
      await sendMessage(botToken, chatId, "🔄 *Retrying...* Sending your application again.")
    } catch (err) {
      await answerCallbackQuery(botToken, callbackQuery.id, `Error: ${String(err)}`)
    }
  }
}

// ── Execute approved action (send email via Token Vault) ──

export const executeApprovedAction = internalAction({
  args: { pendingActionId: v.id("pendingActions") },
  handler: async (ctx, { pendingActionId }) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN!
    const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL

    // Get the pending action
    const action = await ctx.runQuery(internal.pendingActions.getById, {
      id: pendingActionId,
    })
    if (!action || action.status !== "approved") {
      console.error("[telegram] Action not found or not approved:", pendingActionId)
      return
    }

    try {
      // Get fresh Gmail token via Token Vault (refresh token exchange)
      const gmailToken = await getGmailTokenViaTokenVault(ctx, action.userId)

      // Get sender info from Auth0 Management API
      const managementToken = await getAuth0ManagementToken()
      const senderInfo = await getUserEmail(managementToken, action.userId)

      // Create application record
      const applicationId = await ctx.runMutation(
        internal.applications.internalCreate,
        {
          userId: action.userId,
          company: action.payload.company,
          role: action.payload.role,
          coverLetter: action.payload.coverLetter,
          recipientEmail: action.payload.to,
          source: "telegram" as const,
        }
      )

      // Build tracking pixel URL
      const trackingPixelUrl = convexSiteUrl
        ? `${convexSiteUrl}/track/open?id=${applicationId}`
        : undefined

      // Encode and send email
      const encodedEmail = encodeEmail({
        to: action.payload.to,
        subject: action.payload.subject,
        body: action.payload.body,
        from: senderInfo ?? undefined,
        trackingPixelUrl,
      })

      const gmailRes = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${gmailToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw: encodedEmail }),
        }
      )

      if (!gmailRes.ok) {
        const err = await gmailRes.json()
        throw new Error(`Gmail send failed: ${JSON.stringify(err)}`)
      }

      const gmailResult = await gmailRes.json()

      // Store thread ID
      if (gmailResult.threadId) {
        try {
          await ctx.runMutation(internal.applications.internalSetThreadId, {
            id: applicationId,
            gmailThreadId: gmailResult.threadId,
          })
        } catch {
          // Non-critical
        }
      }

      // Mark action as executed
      await ctx.runMutation(internal.pendingActions.updateStatus, {
        id: pendingActionId,
        status: "executed",
        applicationId,
      })

      // Notify user via Telegram
      if (action.telegramChatId) {
        await sendMessage(
          botToken,
          action.telegramChatId,
          `🎉 *Application sent!*\n\n` +
            `*${action.payload.company}* — ${action.payload.role}\n` +
            `📬 Sent to: ${action.payload.to}\n\n` +
            `_I'll notify you when they reply._`
        )
      }
    } catch (err) {
      // Mark action as failed
      await ctx.runMutation(internal.pendingActions.updateStatus, {
        id: pendingActionId,
        status: "failed",
        error: String(err),
      })

      // Notify user via Telegram with retry button
      if (action.telegramChatId) {
        await sendMessage(
          botToken,
          action.telegramChatId,
          `⚠️ *Failed to send application*\n\n` +
            `${action.payload.company} — ${action.payload.role}\n` +
            `Error: ${String(err)}`,
          {
            inline_keyboard: [
              [{ text: "🔄 Retry", callback_data: `retry:${pendingActionId}` }],
            ],
          }
        )
      }
    }
  },
})

// ── Send notification (called from other modules) ──

export const sendNotification = internalAction({
  args: {
    chatId: v.string(),
    text: v.string(),
  },
  handler: async (_ctx, { chatId, text }) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN!
    await sendMessage(botToken, chatId, text)
  },
})

// ── Helper: generate random linking code ──

function generateCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let result = ""
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
