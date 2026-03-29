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
  let greeting = "👋 <b>Welcome to OutreachAgent!</b>\n\n"
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
      "Your AI-powered B2B outreach agent. I sync contacts from HubSpot, generate personalized emails, and send them through your Gmail — all from Telegram.\n\n" +
      "1️⃣ Link your account: /link\n" +
      "2️⃣ Sync contacts: /sync\n" +
      "3️⃣ Review & approve outreach with one tap\n\n" +
      "<b>Commands:</b>\n" +
      "/sync — Sync contacts from HubSpot CRM\n" +
      "/outreach — View outreach pipeline & stats\n" +
      "/auto — Toggle auto mode (send without approval)\n" +
      "/status — Check pipeline health\n" +
      "/link — Link your account\n" +
      "/unlink — Unlink your account\n" +
      "/links — Set GitHub, LinkedIn, portfolio URLs\n" +
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
    "🔗 <b>Link your OutreachAgent account</b>\n\n" +
      `Open this link while logged in:\n${linkUrl}\n\n` +
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
        "Outreach emails will now be sent <b>automatically</b> without requiring your approval.\n\n" +
        "⚠️ AI-generated emails will be dispatched immediately to your contacts.\n\n" +
        "Use /auto again to turn it off."
    )
  } else {
    await sendMessage(
      botToken,
      chatId,
      "✋ <b>Auto Mode: OFF</b>\n\n" +
        "Outreach emails will require your approval before sending.\n\n" +
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
  // Pipeline health check
  const diag = await ctx.runQuery(
    internal.sourcing.cron.getPipelineDiagnostic,
    { userId }
  )

  const check = (ok: boolean) => (ok ? "\u2705" : "\u274c")
  const healthLines = [
    `${check(diag.hasResumeProfile)} Resume uploaded`,
    `${check(diag.hasTelegramLink)} Telegram linked`,
    `${check(diag.autoModeEnabled)} Auto mode enabled`,
    `${check(diag.hasGmailToken)} Gmail connected`,
  ]

  if (diag.failedActionCount > 0) {
    healthLines.push(
      `\u274c ${diag.failedActionCount} failed email send(s) in last 24h`
    )
  }

  const allOk =
    diag.hasResumeProfile &&
    diag.hasTelegramLink &&
    diag.hasGmailToken &&
    diag.failedActionCount === 0

  const headerEmoji = allOk ? "\u2705" : "\u26a0\ufe0f"
  const headerText = allOk
    ? "Pipeline is healthy"
    : "Pipeline has issues — outreach may not work"

  let msg = `${headerEmoji} <b>${headerText}</b>\n\n${healthLines.join("\n")}`

  // Outreach stats
  const stats = await ctx.runQuery(
    internal.outbound.store.getOutreachStats,
    { userId }
  )

  msg += `\n\n<b>Outreach Summary</b>\n\n` +
    `📇 Contacts: ${stats.contactCount}\n` +
    `🔄 Active sequences: ${stats.activeSequences}\n` +
    `✅ Completed: ${stats.completedSequences}\n` +
    `📤 Sent: ${stats.sent}  ·  👁 Opened: ${stats.opened}  ·  💬 Replied: ${stats.replied}`

  if (stats.failed > 0) {
    msg += `\n❌ Failed: ${stats.failed}`
  }

  if (stats.contactCount === 0) {
    msg += `\n\nNo contacts yet. Use /sync to pull from HubSpot.`
  }

  msg += `\n\nView dashboard:\n${siteUrl}/dashboard`

  await sendMessage(botToken, chatId, msg)
}

// ── /links ──

export async function handleLinks(
  ctx: ActionCtx,
  botToken: string,
  chatId: string,
  text: string,
  userId: string
) {
  const arg = text.replace("/links", "").trim()

  // Show current links if no argument
  if (!arg) {
    const profile = await ctx.runQuery(
      internal.resumeProfiles.getByUserInternal,
      { userId }
    )
    if (!profile) {
      await sendMessage(
        botToken,
        chatId,
        "⚠️ No resume profile found. Upload your CV first on the web app."
      )
      return
    }
    const lines = [
      profile.githubUrl ? `GitHub: ${profile.githubUrl}` : "GitHub: <i>not set</i>",
      profile.linkedinUrl ? `LinkedIn: ${profile.linkedinUrl}` : "LinkedIn: <i>not set</i>",
      profile.portfolioUrl ? `Portfolio: ${profile.portfolioUrl}` : "Portfolio: <i>not set</i>",
    ]
    await sendMessage(
      botToken,
      chatId,
      `🔗 <b>Profile Links</b>\n\n${lines.join("\n")}\n\n` +
        "To update:\n" +
        "<code>/links github https://github.com/you</code>\n" +
        "<code>/links linkedin https://linkedin.com/in/you</code>\n" +
        "<code>/links portfolio https://you.dev</code>\n" +
        "<code>/links clear github</code>"
    )
    return
  }

  const parts = arg.split(/\s+/)
  const field = parts[0]?.toLowerCase()
  const value = parts[1]?.trim()

  const fieldMap: Record<string, "githubUrl" | "linkedinUrl" | "portfolioUrl"> = {
    github: "githubUrl",
    linkedin: "linkedinUrl",
    portfolio: "portfolioUrl",
  }

  if (field === "clear" && parts[1]) {
    const clearField = parts[1].toLowerCase()
    const dbField = fieldMap[clearField]
    if (!dbField) {
      await sendMessage(
        botToken,
        chatId,
        "⚠️ Unknown link type. Use: github, linkedin, or portfolio."
      )
      return
    }
    await ctx.runMutation(internal.resumeProfiles.internalUpdateLinks, {
      userId,
      [dbField]: undefined,
    })
    await sendMessage(botToken, chatId, `✅ ${clearField} link removed.`)
    return
  }

  const dbField = fieldMap[field]
  if (!dbField) {
    await sendMessage(
      botToken,
      chatId,
      "⚠️ Unknown link type. Use: github, linkedin, or portfolio.\n\n" +
        "Example: <code>/links github https://github.com/you</code>"
    )
    return
  }

  if (!value) {
    await sendMessage(
      botToken,
      chatId,
      `⚠️ Please provide a URL.\n\nExample: <code>/links ${field} https://example.com</code>`
    )
    return
  }

  await ctx.runMutation(internal.resumeProfiles.internalUpdateLinks, {
    userId,
    [dbField]: value,
  })
  await sendMessage(botToken, chatId, `✅ ${field} link saved: ${value}`)
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

// ── /outreach ──

export async function handleOutreach(
  ctx: ActionCtx,
  botToken: string,
  chatId: string,
  userId: string
) {
  const stats = await ctx.runQuery(
    internal.outbound.store.getOutreachStats,
    { userId }
  )

  const lines = [
    `📊 <b>Outreach Pipeline</b>\n`,
    `<b>Contacts synced:</b> ${stats.contactCount}`,
    `<b>Active sequences:</b> ${stats.activeSequences}`,
    `<b>Completed sequences:</b> ${stats.completedSequences}`,
    ``,
    `<b>Messages:</b>`,
    `  Sent: ${stats.sent}`,
    `  Opened: ${stats.opened}`,
    `  Replied: ${stats.replied}`,
    `  Failed: ${stats.failed}`,
  ]

  if (stats.contactCount === 0) {
    lines.push(
      ``,
      `No contacts synced yet. Use /sync to pull contacts from HubSpot.`
    )
  }

  await sendMessage(botToken, chatId, lines.join("\n"))
}

// ── /sync ──

export async function handleSync(
  ctx: ActionCtx,
  botToken: string,
  chatId: string
) {
  await sendMessage(
    botToken,
    chatId,
    "🔄 <b>Syncing contacts from HubSpot...</b>\n\nThis may take a moment."
  )

  try {
    await ctx.runAction(internal.outbound.hubspot.fetchAndSyncContacts, {})

    const contactCount = await ctx.runQuery(
      internal.outbound.store.getContactCount,
      {}
    )

    await sendMessage(
      botToken,
      chatId,
      `✅ <b>Sync complete!</b>\n\n${contactCount} contact(s) in database.\n\nUse /outreach to see your pipeline stats.`
    )
  } catch (err) {
    await sendMessage(
      botToken,
      chatId,
      `❌ <b>Sync failed</b>\n\n${escapeHtml(String(err))}`
    )
  }
}
