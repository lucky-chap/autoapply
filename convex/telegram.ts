import { internalAction, ActionCtx } from "./_generated/server"
import { internal } from "./_generated/api"
import { v } from "convex/values"
import { Id } from "./_generated/dataModel"
import { extractJobInfoHelper, generateCoverLetterHelper } from "./aiActions"
import { getGmailTokenViaTokenVault } from "./tokenVault"
import { getAuth0ManagementToken, getUserEmail } from "./auth0"

// ── Telegram Bot API helpers ──

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

async function sendTelegram(
  botToken: string,
  method: string,
  body: Record<string, unknown>
): Promise<unknown> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error(`[telegram] ${method} failed: ${err}`)
    throw new Error(`Telegram ${method} failed: ${err}`)
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
    parse_mode: "HTML",
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

async function answerCallbackQuery(
  botToken: string,
  callbackQueryId: string,
  text: string
) {
  return sendTelegram(botToken, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
  })
}

// ── Base64 helpers (Convex runtime has no Node Buffer) ──

function toBase64(str: string): string {
  return btoa(
    Array.from(new TextEncoder().encode(str), (b) =>
      String.fromCharCode(b)
    ).join("")
  )
}

function toBase64Url(str: string): string {
  return toBase64(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
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
  const pendingActionId = await ctx.runMutation(
    internal.pendingActions.create,
    {
      userId,
      actionType: "send_email" as const,
      payload,
      telegramChatId: chatId,
      source: "telegram" as const,
    }
  )

  const preview =
    payload.coverLetter.length > 500
      ? payload.coverLetter.slice(0, 500) + "..."
      : payload.coverLetter

  const result = (await sendMessage(
    botToken,
    chatId,
    `📧 <b>Ready to send application</b>\n\n` +
      `<b>Company:</b> ${escapeHtml(payload.company)}\n` +
      `<b>Role:</b> ${escapeHtml(payload.role)}\n` +
      `<b>To:</b> ${escapeHtml(payload.to)}\n\n` +
      `<b>Cover Letter Preview:</b>\n${escapeHtml(preview)}`,
    {
      inline_keyboard: [
        [
          {
            text: "✅ Approve & Send",
            callback_data: `approve:${pendingActionId}`,
          },
          { text: "❌ Reject", callback_data: `reject:${pendingActionId}` },
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
}

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
      let greeting = "👋 <b>Welcome to AutoApply Bot!</b>\n\n"
      if (existingLink) {
        try {
          const mgmtToken = await getAuth0ManagementToken()
          const userInfo = await getUserEmail(mgmtToken, existingLink.userId)
          if (userInfo) {
            greeting += `✅ Logged in as <b>${escapeHtml(userInfo.name)}</b> (${escapeHtml(userInfo.email)})\n\n`
          }
        } catch {
          /* non-critical */
        }
      }
      await sendMessage(
        botToken,
        chatId,
        greeting +
          "I can help you apply to jobs directly from Telegram.\n\n" +
          "1️⃣ First, link your account: /link (you can skip this step if you are already logged in)\n" +
          "2️⃣ Use /job then paste a job description\n" +
          "3️⃣ Approve the send with one tap\n\n" +
          "Commands:\n" +
          "/link — Link your AutoApply account\n" +
          "/unlink — Unlink your account\n" +
          "/job — Paste a job description\n" +
          "/status — Check your recent applications\n" +
          "/salary — Set minimum salary alert"
      )
      return
    }

    // Command: /link
    if (text === "/link") {
      const existingLink = await ctx.runQuery(
        internal.telegramLinks.getLinkByTelegramChatId,
        { telegramChatId: chatId }
      )
      if (existingLink) {
        let emailInfo = ""
        try {
          const mgmtToken = await getAuth0ManagementToken()
          const userInfo = await getUserEmail(mgmtToken, existingLink.userId)
          if (userInfo) emailInfo = ` as <b>${escapeHtml(userInfo.email)}</b>`
        } catch {
          /* non-critical */
        }
        await sendMessage(
          botToken,
          chatId,
          `✅ Your account is already linked${emailInfo}.\n\n` +
            "To re-link a different account, use /unlink first."
        )
        return
      }

      const code = generateCode()
      await ctx.runMutation(internal.telegramLinks.createLinkingCode, {
        code,
        telegramChatId: chatId,
      })
      const linkUrl = `${siteUrl}/api/telegram/link?code=${code}`
      await sendMessage(
        botToken,
        chatId,
        "🔗 <b>Link your AutoApply account</b>\n\n" +
          `Open this link while logged in to AutoApply:\n${linkUrl}\n\n` +
          "<i>This link expires in 15 minutes.</i>"
      )
      return
    }

    // Command: /unlink
    if (text === "/unlink") {
      const existingLink = await ctx.runQuery(
        internal.telegramLinks.getLinkByTelegramChatId,
        { telegramChatId: chatId }
      )
      if (!existingLink) {
        await sendMessage(
          botToken,
          chatId,
          "⚠️ No account is linked to this chat. Use /link to connect one."
        )
        return
      }
      await ctx.runMutation(internal.telegramLinks.internalUnlinkByChatId, {
        telegramChatId: chatId,
      })
      await sendMessage(
        botToken,
        chatId,
        "🔓 Account unlinked. Use /link to connect a different account."
      )
      return
    }

    // Command: /salary
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

      const arg = text.replace("/salary", "").trim()
      if (!arg) {
        // Show current salary setting
        const prefs = await ctx.runQuery(
          internal.preferences.getByUserInternal,
          { userId: link.userId }
        )
        if (prefs?.minSalary) {
          await sendMessage(
            botToken,
            chatId,
            `💰 Your minimum salary is set to <b>$${prefs.minSalary.toLocaleString("en-US")}</b>.\n\n` +
              "To change it: <code>/salary 120000</code>\nTo remove it: <code>/salary off</code>"
          )
        } else {
          await sendMessage(
            botToken,
            chatId,
            "💰 No minimum salary set. I'll process all jobs without salary warnings.\n\n" +
              "To set one: <code>/salary 120000</code>"
          )
        }
        return
      }

      if (arg.toLowerCase() === "off" || arg === "0") {
        const prefs = await ctx.runQuery(
          internal.preferences.getByUserInternal,
          { userId: link.userId }
        )
        if (prefs) {
          await ctx.runMutation(internal.preferences.internalUpdateMinSalary, {
            userId: link.userId,
            minSalary: undefined,
          })
        }
        await sendMessage(
          botToken,
          chatId,
          "💰 Minimum salary removed. I'll process all jobs without salary warnings."
        )
        return
      }

      const parsed = parseInt(arg.replace(/[$,]/g, ""), 10)
      if (isNaN(parsed) || parsed < 0) {
        await sendMessage(
          botToken,
          chatId,
          "⚠️ Please provide a valid number, e.g. <code>/salary 120000</code>"
        )
        return
      }

      await ctx.runMutation(internal.preferences.internalUpdateMinSalary, {
        userId: link.userId,
        minSalary: parsed,
      })
      await sendMessage(
        botToken,
        chatId,
        `💰 Minimum salary set to <b>$${parsed.toLocaleString("en-US")}</b>.\n\n` +
          "I'll warn you before applying to jobs that pay less than this."
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
        await sendMessage(
          botToken,
          chatId,
          "⚠️ Account not linked. Use /link first."
        )
        return
      }

      const recent = await ctx.runQuery(
        internal.applications.getRecentByUserInternal,
        { userId: link.userId, limit: 5 }
      )

      if (recent.length === 0) {
        await sendMessage(
          botToken,
          chatId,
          "📊 No applications yet. Send me a job description to get started!"
        )
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
        const date = new Date(
          app.emailSentAt ?? app.createdAt
        ).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
        const opens = app.openCount
          ? ` · ${app.openCount} open${app.openCount > 1 ? "s" : ""}`
          : ""
        return `${emoji} <b>${escapeHtml(app.company)}</b> — ${escapeHtml(app.role)}\n    ${app.status ?? "Applied"} · ${date}${opens}`
      })

      await sendMessage(
        botToken,
        chatId,
        `📊 <b>Recent Applications</b>\n\n${lines.join("\n\n")}\n\n` +
          `View all on the dashboard:\n${siteUrl}/dashboard`
      )
      return
    }

    // Command: /job — enter job description mode
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
      await ctx.runMutation(internal.telegramLinks.setJobInputMode, {
        telegramChatId: chatId,
      })
      await sendMessage(
        botToken,
        chatId,
        "📋 <b>Ready for a job description!</b>\n\nPaste the job posting below and I'll process it."
      )
      return
    }

    // Non-command text — check if we're expecting input
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
        await sendMessage(
          botToken,
          chatId,
          "⏳ Generating your cover letter..."
        )

        let coverLetter: string
        try {
          coverLetter = await generateCoverLetterHelper(
            ctx,
            pendingInput.jobDescription,
            pendingInput.company,
            pendingInput.role,
            link.userId
          )
        } catch (err) {
          await sendMessage(
            botToken,
            chatId,
            `❌ Failed to generate cover letter: ${String(err)}`
          )
          return
        }

        const email = emailMatch[0]
        const subject = `Application for ${pendingInput.role} at ${pendingInput.company}`

        await createPendingActionAndPreview(
          ctx,
          botToken,
          chatId,
          link.userId,
          {
            to: email,
            subject,
            body: coverLetter,
            company: pendingInput.company,
            role: pendingInput.role,
            coverLetter,
          }
        )
        return
      } else {
        // Not an email — clear the pending state
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
      // Clear the mode and buffer the job description
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
          {
            telegramChatId: chatId,
            userId: link.userId,
          }
        )
      }
      return
    }

    // No active mode — show help
    await sendMessage(
      botToken,
      chatId,
      "💡 Use a command to get started:\n\n" +
        "/job — Paste a job description\n" +
        "/status — Check recent applications\n" +
        "/salary — Set minimum salary alert\n\n" +
        "<i>Send /job first, then paste your job description.</i>"
    )
  },
})

// ── Process job description (shared by direct and buffered flows) ──

async function processJobDescription(
  ctx: ActionCtx,
  botToken: string,
  chatId: string,
  userId: string,
  text: string
) {
  await sendMessage(botToken, chatId, "⏳ Processing your job description...")

  let jobInfo: {
    company: string
    role: string
    email: string
    salary: number | null
    multipleDetected: boolean
  }
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

  if (jobInfo.multipleDetected) {
    await sendMessage(
      botToken,
      chatId,
      "⚠️ It looks like you pasted <b>multiple job postings</b> in one message.\n\n" +
        "Please send them <b>one at a time</b> so I can process each correctly."
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
    await ctx.runMutation(internal.telegramLinks.savePendingEmailInput, {
      telegramChatId: chatId,
      jobDescription: text,
      company: jobInfo.company,
      role: jobInfo.role,
    })
    await sendMessage(
      botToken,
      chatId,
      `📝 Found: <b>${escapeHtml(jobInfo.company)}</b> — <b>${escapeHtml(jobInfo.role)}</b>\n\n` +
        "⚠️ No contact email found in the posting. Please reply with the recruiter's email address."
    )
    return
  }

  // Check salary against user preferences
  const prefs = await ctx.runQuery(internal.preferences.getByUserInternal, {
    userId,
  })
  if (
    prefs?.minSalary &&
    jobInfo.salary !== null &&
    jobInfo.salary < prefs.minSalary
  ) {
    const formatSalary = (n: number) => "$" + n.toLocaleString("en-US")
    const reviewId = await ctx.runMutation(
      internal.telegramLinks.savePendingSalaryReview,
      {
        telegramChatId: chatId,
        userId,
        jobDescription: text,
        company: jobInfo.company,
        role: jobInfo.role,
        email: jobInfo.email,
        salary: jobInfo.salary,
      }
    )
    await sendMessage(
      botToken,
      chatId,
      `💰 <b>Salary alert</b>\n\n` +
        `<b>${escapeHtml(jobInfo.company)}</b> — ${escapeHtml(jobInfo.role)}\n` +
        `Listed salary: <b>${formatSalary(jobInfo.salary)}</b>\n` +
        `Your minimum: <b>${formatSalary(prefs.minSalary)}</b>\n\n` +
        `This role pays <b>${formatSalary(prefs.minSalary - jobInfo.salary)}</b> below your minimum. Do you still want to apply?`,
      {
        inline_keyboard: [
          [
            {
              text: "✅ Apply anyway",
              callback_data: `salary_proceed:${reviewId}`,
            },
            { text: "⏭ Skip", callback_data: `salary_skip:${reviewId}` },
          ],
        ],
      }
    )
    return
  }

  await continueWithApplication(
    ctx,
    botToken,
    chatId,
    userId,
    text,
    jobInfo.company,
    jobInfo.role,
    jobInfo.email
  )
}

async function continueWithApplication(
  ctx: ActionCtx,
  botToken: string,
  chatId: string,
  userId: string,
  jobDescription: string,
  company: string,
  role: string,
  email: string
) {
  let coverLetter: string
  try {
    coverLetter = await generateCoverLetterHelper(
      ctx,
      jobDescription,
      company,
      role,
      userId
    )
  } catch (err) {
    await sendMessage(
      botToken,
      chatId,
      `❌ Failed to generate cover letter: ${String(err)}`
    )
    return
  }

  const subject = `Application for ${role} at ${company}`
  await createPendingActionAndPreview(ctx, botToken, chatId, userId, {
    to: email,
    subject,
    body: coverLetter,
    company,
    role,
    coverLetter,
  })
}

// ── Buffered message processor (debounced) ──

export const processBufferedMessage = internalAction({
  args: {
    telegramChatId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, { telegramChatId, userId }) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN!

    // Check if more messages are still arriving (debounce)
    const buf = await ctx.runQuery(internal.telegramLinks.getMessageBuffer, {
      telegramChatId,
    })
    if (!buf) return

    if (Date.now() - buf.lastMessageAt < 2000) {
      // More parts may be incoming — reschedule
      await ctx.scheduler.runAfter(
        2000,
        internal.telegram.processBufferedMessage,
        {
          telegramChatId,
          userId,
        }
      )
      return
    }

    // Consume the buffer and process
    const fullText: string | null = await ctx.runMutation(
      internal.telegramLinks.consumeMessageBuffer,
      { telegramChatId }
    )
    if (!fullText) return

    await processJobDescription(ctx, botToken, telegramChatId, userId, fullText)
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
      await answerCallbackQuery(
        botToken,
        callbackQuery.id,
        "Approved! Sending email..."
      )
      if (messageId) {
        await editMessageReplyMarkup(botToken, chatId, messageId)
      }
      await sendMessage(
        botToken,
        chatId,
        "✅ <b>Approved!</b> Sending your application now..."
      )
    } catch (err) {
      await answerCallbackQuery(
        botToken,
        callbackQuery.id,
        `Error: ${String(err)}`
      )
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
      await sendMessage(
        botToken,
        chatId,
        "❌ Application rejected. The email was not sent."
      )
    } catch (err) {
      await answerCallbackQuery(
        botToken,
        callbackQuery.id,
        `Error: ${String(err)}`
      )
    }
  } else if (data.startsWith("salary_proceed:")) {
    const reviewId = data.replace(
      "salary_proceed:",
      ""
    ) as Id<"pendingSalaryReview">
    try {
      const review = await ctx.runQuery(
        internal.telegramLinks.getPendingSalaryReview,
        { id: reviewId }
      )
      if (!review) {
        await answerCallbackQuery(
          botToken,
          callbackQuery.id,
          "This review has expired."
        )
        return
      }
      await ctx.runMutation(internal.telegramLinks.deletePendingSalaryReview, {
        id: reviewId,
      })
      await answerCallbackQuery(
        botToken,
        callbackQuery.id,
        "Proceeding with application..."
      )
      if (messageId) {
        await editMessageReplyMarkup(botToken, chatId, messageId)
      }
      await sendMessage(botToken, chatId, "⏳ Generating your cover letter...")
      await continueWithApplication(
        ctx,
        botToken,
        chatId,
        review.userId,
        review.jobDescription,
        review.company,
        review.role,
        review.email
      )
    } catch (err) {
      await answerCallbackQuery(
        botToken,
        callbackQuery.id,
        `Error: ${String(err)}`
      )
    }
  } else if (data.startsWith("salary_skip:")) {
    const reviewId = data.replace(
      "salary_skip:",
      ""
    ) as Id<"pendingSalaryReview">
    try {
      await ctx.runMutation(internal.telegramLinks.deletePendingSalaryReview, {
        id: reviewId,
      })
      await answerCallbackQuery(botToken, callbackQuery.id, "Skipped.")
      if (messageId) {
        await editMessageReplyMarkup(botToken, chatId, messageId)
      }
      await sendMessage(
        botToken,
        chatId,
        "⏭ Skipped. Send another job description when you're ready."
      )
    } catch (err) {
      await answerCallbackQuery(
        botToken,
        callbackQuery.id,
        `Error: ${String(err)}`
      )
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
      await sendMessage(
        botToken,
        chatId,
        "🔄 <b>Retrying...</b> Sending your application again."
      )
    } catch (err) {
      await answerCallbackQuery(
        botToken,
        callbackQuery.id,
        `Error: ${String(err)}`
      )
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
      console.error(
        "[telegram] Action not found or not approved:",
        pendingActionId
      )
      return
    }

    try {
      // Get fresh Gmail token via Token Vault (refresh token exchange)
      const gmailToken = await getGmailTokenViaTokenVault(ctx, action.userId)

      // Get sender info from Auth0 Management API
      const managementToken = await getAuth0ManagementToken()
      const senderInfo = await getUserEmail(managementToken, action.userId)

      const isFollowUp = !!action.applicationId

      // For new applications, create a record. For follow-ups, reuse existing.
      let applicationId: Id<"applications">
      let gmailThreadId: string | undefined
      if (isFollowUp) {
        applicationId = action.applicationId!
        // Look up existing thread ID for threading the reply
        const existingApp = await ctx.runQuery(
          internal.applications.internalGetById,
          {
            id: applicationId,
          }
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
          }
        )
      }

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

      const gmailBody: { raw: string; threadId?: string } = {
        raw: encodedEmail,
      }
      if (gmailThreadId) {
        gmailBody.threadId = gmailThreadId
      }

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

      // Store thread ID (for new applications)
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

      // Mark action as executed
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
          `⚠️ <b>Failed to send application</b>\n\n` +
            `${escapeHtml(action.payload.company)} — ${escapeHtml(action.payload.role)}\n` +
            `Error: ${escapeHtml(String(err))}`,
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
