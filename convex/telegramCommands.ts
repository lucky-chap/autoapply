/**
 * Telegram bot command handlers — /start, /link, /unlink, /salary,
 * /auto, /clear, /status, /job.
 *
 * Each handler is a plain async function called from processUpdate
 * in telegram.ts. They receive the ActionCtx, botToken, chatId,
 * and any extra state they need.
 */

import { ActionCtx } from "./_generated/server"
import { internal } from "./_generated/api"
import { escapeHtml, sendMessage, generateLinkingCode } from "./telegramHelpers"
import { getAuth0ManagementToken, getUserEmail } from "./auth0"

// ── /start ──

export async function handleStart(
  ctx: ActionCtx,
  botToken: string,
  chatId: string,
  siteUrl: string
) {
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
      "/salary — Set minimum salary alert\n" +
      "/auto — Toggle auto mode (send without approval)\n" +
      "/clear — Clear all pending chat state"
  )
}

// ── /link ──

export async function handleLink(
  ctx: ActionCtx,
  botToken: string,
  chatId: string,
  siteUrl: string
) {
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

  const code = generateLinkingCode()
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
}

// ── /unlink ──

export async function handleUnlink(
  ctx: ActionCtx,
  botToken: string,
  chatId: string
) {
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
}

// ── /salary ──

export async function handleSalary(
  ctx: ActionCtx,
  botToken: string,
  chatId: string,
  text: string,
  userId: string
) {
  const arg = text.replace("/salary", "").trim()
  if (!arg) {
    const prefs = await ctx.runQuery(
      internal.preferences.getByUserInternal,
      { userId }
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
      { userId }
    )
    if (prefs) {
      await ctx.runMutation(internal.preferences.internalUpdateMinSalary, {
        userId,
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
    userId,
    minSalary: parsed,
  })
  await sendMessage(
    botToken,
    chatId,
    `💰 Minimum salary set to <b>$${parsed.toLocaleString("en-US")}</b>.\n\n` +
      "I'll warn you before applying to jobs that pay less than this."
  )
}

// ── /auto ──

export async function handleAuto(
  ctx: ActionCtx,
  botToken: string,
  chatId: string,
  userId: string
) {
  const newAutoMode = await ctx.runMutation(
    internal.userSettings.internalToggleAutoMode,
    { userId }
  )
  if (newAutoMode) {
    await sendMessage(
      botToken,
      chatId,
      "🤖 <b>Auto Mode: ON</b>\n\n" +
        "Applications will now be sent <b>automatically</b> without requiring your approval.\n\n" +
        "⚠️ Cover letters will be generated and emailed immediately when you send a job description.\n\n" +
        "Use /auto again to turn it off."
    )
  } else {
    await sendMessage(
      botToken,
      chatId,
      "✋ <b>Auto Mode: OFF</b>\n\n" +
        "Applications will require your approval before sending.\n\n" +
        "Use /auto again to turn it on."
    )
  }
}

// ── /clear ──

export async function handleClear(
  ctx: ActionCtx,
  botToken: string,
  chatId: string,
  userId: string | undefined
) {
  await ctx.runMutation(internal.chatCleanup.clearChatState, {
    telegramChatId: chatId,
    userId,
  })
  await sendMessage(
    botToken,
    chatId,
    "🧹 <b>Chat state cleared.</b>\n\nAll pending buffers, inputs, and pending actions have been removed."
  )
}

// ── /status ──

export async function handleStatus(
  ctx: ActionCtx,
  botToken: string,
  chatId: string,
  userId: string,
  siteUrl: string
) {
  const recent = await ctx.runQuery(
    internal.applications.getRecentByUserInternal,
    { userId, limit: 5 }
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
}

// ── /job ──

export async function handleJob(
  ctx: ActionCtx,
  botToken: string,
  chatId: string
) {
  await ctx.runMutation(internal.telegramLinks.setJobInputMode, {
    telegramChatId: chatId,
  })
  await sendMessage(
    botToken,
    chatId,
    "📋 <b>Ready for a job description!</b>\n\nPaste the job posting below and I'll process it."
  )
}
