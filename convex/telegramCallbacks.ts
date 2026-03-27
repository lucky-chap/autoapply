/**
 * Telegram callback query handlers — button presses from inline keyboards.
 *
 * Handles: approve, reject, salary_proceed, salary_skip, retry,
 * cal (calendar check), cal_reply, cal_block, cal_ev, toggle_resume.
 */

import { ActionCtx } from "./_generated/server"
import { internal } from "./_generated/api"
import { Id } from "./_generated/dataModel"
import { analyzeAvailability } from "./calendar"
import {
  escapeHtml,
  sendTelegram,
  sendMessage,
  editMessageReplyMarkup,
  answerCallbackQuery,
} from "./telegramHelpers"

interface CallbackQuery {
  id: string
  data?: string
  message?: { chat: { id: number }; message_id: number }
}

export async function handleCallbackQuery(
  ctx: ActionCtx,
  botToken: string,
  callbackQuery: CallbackQuery
) {
  const data = callbackQuery.data
  if (!data) return

  const chatId = String(callbackQuery.message?.chat.id)
  const messageId = callbackQuery.message?.message_id

  if (data.startsWith("approve:")) {
    await handleApprove(ctx, botToken, chatId, messageId, callbackQuery.id, data)
  } else if (data.startsWith("reject:")) {
    await handleReject(ctx, botToken, chatId, messageId, callbackQuery.id, data)
  } else if (data.startsWith("salary_proceed:")) {
    await handleSalaryProceed(ctx, botToken, chatId, messageId, callbackQuery.id, data)
  } else if (data.startsWith("salary_skip:")) {
    await handleSalarySkip(ctx, botToken, chatId, messageId, callbackQuery.id, data)
  } else if (data.startsWith("retry:")) {
    await handleRetry(ctx, botToken, chatId, messageId, callbackQuery.id, data)
  } else if (data.startsWith("cal_reply:")) {
    await handleCalReply(ctx, botToken, chatId, callbackQuery.id, data)
  } else if (data.startsWith("cal_block:")) {
    await handleCalBlock(ctx, botToken, chatId, callbackQuery.id, data)
  } else if (data.startsWith("cal_ev:")) {
    await handleCalEvent(ctx, botToken, chatId, callbackQuery.id, data)
  } else if (data.startsWith("cal:")) {
    await handleCalCheck(ctx, botToken, chatId, callbackQuery.id, data)
  } else if (data.startsWith("toggle_resume:")) {
    await handleToggleResume(ctx, botToken, chatId, callbackQuery, data)
  }
}

// ── Approve ──

async function handleApprove(
  ctx: ActionCtx, botToken: string, chatId: string,
  messageId: number | undefined, callbackQueryId: string, data: string
) {
  const actionId = data.replace("approve:", "") as Id<"pendingActions">
  try {
    await ctx.runMutation(internal.pendingActions.internalApprove, { id: actionId })
    await answerCallbackQuery(botToken, callbackQueryId, "Approved! Sending email...")
    if (messageId) await editMessageReplyMarkup(botToken, chatId, messageId)
    await sendMessage(botToken, chatId, "✅ <b>Approved!</b> Sending your application now...")
  } catch (err) {
    await answerCallbackQuery(botToken, callbackQueryId, `Error: ${String(err)}`)
  }
}

// ── Reject ──

async function handleReject(
  ctx: ActionCtx, botToken: string, chatId: string,
  messageId: number | undefined, callbackQueryId: string, data: string
) {
  const actionId = data.replace("reject:", "") as Id<"pendingActions">
  try {
    await ctx.runMutation(internal.pendingActions.internalReject, { id: actionId })
    await answerCallbackQuery(botToken, callbackQueryId, "Rejected.")
    if (messageId) await editMessageReplyMarkup(botToken, chatId, messageId)
    await sendMessage(botToken, chatId, "❌ Application rejected. The email was not sent.")
  } catch (err) {
    await answerCallbackQuery(botToken, callbackQueryId, `Error: ${String(err)}`)
  }
}

// ── Salary proceed ──

async function handleSalaryProceed(
  ctx: ActionCtx, botToken: string, chatId: string,
  messageId: number | undefined, callbackQueryId: string, data: string
) {
  const reviewId = data.replace("salary_proceed:", "") as Id<"pendingSalaryReview">
  try {
    const review = await ctx.runQuery(
      internal.telegramLinks.getPendingSalaryReview,
      { id: reviewId }
    )
    if (!review) {
      await answerCallbackQuery(botToken, callbackQueryId, "This review has expired.")
      return
    }
    await ctx.runMutation(internal.telegramLinks.deletePendingSalaryReview, { id: reviewId })
    await answerCallbackQuery(botToken, callbackQueryId, "Proceeding with application...")
    if (messageId) await editMessageReplyMarkup(botToken, chatId, messageId)
    await sendMessage(botToken, chatId, "⏳ Generating your cover letter...")

    // Import dynamically to avoid circular deps — we call back into the
    // application flow that lives in telegram.ts
    const { continueWithApplication } = await import("./telegramJobFlow")
    await continueWithApplication(
      ctx, botToken, chatId, review.userId,
      review.jobDescription, review.company, review.role, review.email
    )
  } catch (err) {
    await answerCallbackQuery(botToken, callbackQueryId, `Error: ${String(err)}`)
  }
}

// ── Salary skip ──

async function handleSalarySkip(
  ctx: ActionCtx, botToken: string, chatId: string,
  messageId: number | undefined, callbackQueryId: string, data: string
) {
  const reviewId = data.replace("salary_skip:", "") as Id<"pendingSalaryReview">
  try {
    await ctx.runMutation(internal.telegramLinks.deletePendingSalaryReview, { id: reviewId })
    await answerCallbackQuery(botToken, callbackQueryId, "Skipped.")
    if (messageId) await editMessageReplyMarkup(botToken, chatId, messageId)
    await sendMessage(botToken, chatId, "⏭ Skipped. Send another job description when you're ready.")
  } catch (err) {
    await answerCallbackQuery(botToken, callbackQueryId, `Error: ${String(err)}`)
  }
}

// ── Retry failed ──

async function handleRetry(
  ctx: ActionCtx, botToken: string, chatId: string,
  messageId: number | undefined, callbackQueryId: string, data: string
) {
  const actionId = data.replace("retry:", "") as Id<"pendingActions">
  try {
    await ctx.runMutation(internal.pendingActions.retryFailed, { id: actionId })
    await answerCallbackQuery(botToken, callbackQueryId, "Retrying...")
    if (messageId) await editMessageReplyMarkup(botToken, chatId, messageId)
    await sendMessage(botToken, chatId, "🔄 <b>Retrying...</b> Sending your application again.")
  } catch (err) {
    await answerCallbackQuery(botToken, callbackQueryId, `Error: ${String(err)}`)
  }
}

// ── Calendar: check availability ──

async function handleCalCheck(
  ctx: ActionCtx, botToken: string, chatId: string,
  callbackQueryId: string, data: string
) {
  const appId = data.replace("cal:", "") as Id<"applications">
  try {
    const link = await ctx.runQuery(
      internal.telegramLinks.getLinkByTelegramChatId,
      { telegramChatId: chatId }
    )
    if (!link) {
      await answerCallbackQuery(botToken, callbackQueryId, "Account not linked.")
      return
    }

    await answerCallbackQuery(botToken, callbackQueryId)
    await sendMessage(botToken, chatId, "⏳ <b>Checking your calendar...</b>")

    const app = await ctx.runQuery(internal.applications.internalGetById, { id: appId })
    if (!app) {
      await sendMessage(botToken, chatId, "❌ Application not found.")
      return
    }

    const now = new Date()
    const end = new Date(now.getTime() + 48 * 60 * 60 * 1000)

    const events = await ctx.runAction(internal.calendar.getCalendarConflicts, {
      userId: link.userId,
      startTime: now.toISOString(),
      endTime: end.toISOString(),
    })

    const calSettings = await ctx.runQuery(
      internal.userSettings.getByUserInternal,
      { userId: link.userId }
    )

    const result = analyzeAvailability(
      events, app.proposedTimes || [], now, end,
      calSettings?.availabilitySchedule ?? undefined
    )

    await ctx.runMutation(internal.calendar.upsertCalendarSlots, {
      applicationId: appId,
      telegramChatId: chatId,
      slots: result.suggestedSlots,
      proposedTimeStatus: result.proposedTimeStatus,
    })

    // Build message
    let msg = `📅 <b>Calendar Check — ${escapeHtml(app.company)} (${escapeHtml(app.role)})</b>\n`

    if (result.events.length > 0) {
      msg += `\n<b>Upcoming Events (Next 48h):</b>\n`
      for (const ev of result.events) {
        msg += `• <b>${escapeHtml(ev.summary)}</b>\n  ${escapeHtml(ev.label)}\n`
      }
    } else {
      msg += `\nYour calendar is clear for the next 48 hours.\n`
    }

    if (result.proposedTimeStatus.length > 0) {
      msg += `\n⏰ <b>Proposed Times from Recruiter:</b>\n`
      for (const pt of result.proposedTimeStatus) {
        const icon = pt.available === true ? "✅" : pt.available === false ? "❌" : "❓"
        msg += `${icon} ${escapeHtml(pt.label)}\n`
      }
    }

    if (result.suggestedSlots.length > 0) {
      msg += `\n💡 <b>Suggested Free Slots:</b>\n`
      result.suggestedSlots.forEach((s, i) => {
        msg += `${i + 1}. ${escapeHtml(s.label)}\n`
      })
    }

    const buttons: { text: string; callback_data: string }[][] = [
      [
        { text: "📧 Reply with Availability", callback_data: `cal_reply:${appId}` },
        { text: "📅 Block Time", callback_data: `cal_block:${appId}` },
      ],
    ]

    await sendMessage(botToken, chatId, msg, { inline_keyboard: buttons })
  } catch (err) {
    console.error("[telegram] cal: check failed:", err)
    if (String(err).includes("MISSING_CALENDAR_SCOPE")) {
      const permissionsUrl =
        (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_CONVEX_SITE_URL || "") +
        "/permissions"
      await sendMessage(
        botToken, chatId,
        `🔒 <b>Calendar access not enabled</b>\n\n` +
          `To use calendar features, you need to grant Google Calendar permission.\n\n` +
          `Visit your permissions page to connect it:\n${permissionsUrl}`
      )
    } else {
      await sendMessage(botToken, chatId, `❌ <b>Failed to check calendar</b>\n\n${escapeHtml(String(err))}`)
    }
  }
}

// ── Calendar: reply with availability ──

async function handleCalReply(
  ctx: ActionCtx, botToken: string, chatId: string,
  callbackQueryId: string, data: string
) {
  const appId = data.replace("cal_reply:", "") as Id<"applications">
  try {
    const link = await ctx.runQuery(
      internal.telegramLinks.getLinkByTelegramChatId,
      { telegramChatId: chatId }
    )
    if (!link) {
      await answerCallbackQuery(botToken, callbackQueryId, "Account not linked.")
      return
    }
    await answerCallbackQuery(botToken, callbackQueryId)

    const app = await ctx.runQuery(internal.applications.internalGetById, { id: appId })
    if (!app) {
      await sendMessage(botToken, chatId, "❌ Application not found.")
      return
    }

    const slotsDoc = await ctx.runQuery(internal.calendar.getCalendarSlots, {
      applicationId: appId,
      telegramChatId: chatId,
    })

    if (!slotsDoc) {
      await sendMessage(botToken, chatId, "⚠️ Already used or expired. Tap below to refresh.", {
        inline_keyboard: [
          [{ text: "📅 Check My Calendar", callback_data: `cal:${appId}` }],
        ],
      })
      return
    }

    const availableTimes: string[] = []
    for (const pt of slotsDoc.proposedTimeStatus) {
      if (pt.available === true) availableTimes.push(pt.label)
    }
    for (const s of slotsDoc.slots) {
      availableTimes.push(s.label)
    }

    if (availableTimes.length === 0) {
      await sendMessage(botToken, chatId, "⚠️ No available slots were found. Try checking your calendar again later.")
      return
    }

    const slotList = availableTimes.map((t) => `- ${t}`).join("\n")
    const emailBody =
      `Hi,\n\n` +
      `Thank you for getting back to me regarding the ${app.role} position.\n\n` +
      `I'm available at the following times:\n\n` +
      `${slotList}\n\n` +
      `Please let me know which works best, and I'll confirm.\n\n` +
      `Best regards`

    const subject = `Re: ${app.role} at ${app.company}`

    const profile = await ctx.runQuery(
      internal.resumeProfiles.getByUserInternal,
      { userId: link.userId }
    )
    const hasResume = !!profile?.fileId

    const pendingActionId = await ctx.runMutation(internal.pendingActions.create, {
      userId: link.userId,
      actionType: "send_email" as const,
      payload: {
        to: app.recipientEmail,
        subject,
        body: emailBody,
        company: app.company,
        role: app.role,
        coverLetter: emailBody,
      },
      telegramChatId: chatId,
      source: "telegram" as const,
      applicationId: appId,
      attachResume: hasResume,
    })

    const preview = emailBody.length > 500 ? emailBody.slice(0, 500) + "..." : emailBody
    const replyButtons: { text: string; callback_data: string }[][] = [
      [
        { text: "✅ Approve & Send", callback_data: `approve:${pendingActionId}` },
        { text: "❌ Reject", callback_data: `reject:${pendingActionId}` },
      ],
    ]
    if (hasResume) {
      replyButtons.push([
        { text: "📎 Resume: ON", callback_data: `toggle_resume:${pendingActionId}` },
      ])
    }

    const attachLine = hasResume ? "\n📎 <b>Resume will be attached</b>" : ""

    const result = (await sendMessage(
      botToken, chatId,
      `📧 <b>Ready to send availability reply</b>\n\n` +
        `<b>To:</b> ${escapeHtml(app.recipientEmail)}\n` +
        `<b>Subject:</b> ${escapeHtml(subject)}${attachLine}\n\n` +
        `<b>Preview:</b>\n${escapeHtml(preview)}`,
      { inline_keyboard: replyButtons }
    )) as { result?: { message_id?: number } }

    if (result?.result?.message_id) {
      await ctx.runMutation(internal.pendingActions.setTelegramMessageId, {
        pendingActionId: pendingActionId as Id<"pendingActions">,
        telegramMessageId: String(result.result.message_id),
      })
    }

    await ctx.runMutation(internal.calendar.deleteCalendarSlots, { id: slotsDoc._id })
  } catch (err) {
    console.error("[telegram] cal_reply failed:", err)
    await sendMessage(botToken, chatId, `❌ <b>Failed to prepare reply</b>\n\n${escapeHtml(String(err))}`)
  }
}

// ── Calendar: show slot picker for blocking ──

async function handleCalBlock(
  ctx: ActionCtx, botToken: string, chatId: string,
  callbackQueryId: string, data: string
) {
  const appId = data.replace("cal_block:", "") as Id<"applications">
  try {
    await answerCallbackQuery(botToken, callbackQueryId)

    const slotsDoc = await ctx.runQuery(internal.calendar.getCalendarSlots, {
      applicationId: appId,
      telegramChatId: chatId,
    })

    if (!slotsDoc || slotsDoc.slots.length === 0) {
      await sendMessage(botToken, chatId, "⚠️ No available slots to block. Tap below to refresh.", {
        inline_keyboard: [
          [{ text: "📅 Check My Calendar", callback_data: `cal:${appId}` }],
        ],
      })
      return
    }

    const buttons = slotsDoc.slots.map((s, i) => [
      { text: `${i + 1}. ${s.label}`, callback_data: `cal_ev:${appId}:${i}` },
    ])

    await sendMessage(botToken, chatId, "📅 <b>Select a slot to block on your calendar:</b>", {
      inline_keyboard: buttons,
    })
  } catch (err) {
    console.error("[telegram] cal_block failed:", err)
    await sendMessage(botToken, chatId, `❌ <b>Failed to show slots</b>\n\n${escapeHtml(String(err))}`)
  }
}

// ── Calendar: create event for selected slot ──

async function handleCalEvent(
  ctx: ActionCtx, botToken: string, chatId: string,
  callbackQueryId: string, data: string
) {
  const parts = data.replace("cal_ev:", "").split(":")
  const appId = parts[0] as Id<"applications">
  const slotIndex = parseInt(parts[1], 10)
  try {
    const link = await ctx.runQuery(
      internal.telegramLinks.getLinkByTelegramChatId,
      { telegramChatId: chatId }
    )
    if (!link) {
      await answerCallbackQuery(botToken, callbackQueryId, "Account not linked.")
      return
    }
    await answerCallbackQuery(botToken, callbackQueryId)

    const app = await ctx.runQuery(internal.applications.internalGetById, { id: appId })
    if (!app) {
      await sendMessage(botToken, chatId, "❌ Application not found.")
      return
    }

    const slotsDoc = await ctx.runQuery(internal.calendar.getCalendarSlots, {
      applicationId: appId,
      telegramChatId: chatId,
    })

    if (!slotsDoc || !slotsDoc.slots[slotIndex]) {
      await sendMessage(botToken, chatId, "⚠️ Slot no longer available. Tap below to refresh.", {
        inline_keyboard: [
          [{ text: "📅 Check My Calendar", callback_data: `cal:${appId}` }],
        ],
      })
      return
    }

    const slot = slotsDoc.slots[slotIndex]

    await ctx.runAction(internal.calendar.createCalendarEvent, {
      userId: link.userId,
      summary: `Interview — ${app.company} (${app.role})`,
      description: "Scheduled via AutoApply",
      startTime: slot.start,
      endTime: slot.end,
    })

    await ctx.runMutation(internal.calendar.deleteCalendarSlots, { id: slotsDoc._id })

    // Compose availability reply email
    const emailBody =
      `Hi,\n\n` +
      `Thank you for getting back to me regarding the ${app.role} position.\n\n` +
      `I'd like to confirm my availability for:\n\n` +
      `- ${slot.label}\n\n` +
      `Please let me know if this works, and I'll be happy to confirm.\n\n` +
      `Best regards`

    const subject = `Re: ${app.role} at ${app.company}`

    const profile = await ctx.runQuery(
      internal.resumeProfiles.getByUserInternal,
      { userId: link.userId }
    )
    const hasResume = !!profile?.fileId

    const pendingActionId = await ctx.runMutation(internal.pendingActions.create, {
      userId: link.userId,
      actionType: "send_email" as const,
      payload: {
        to: app.recipientEmail,
        subject,
        body: emailBody,
        company: app.company,
        role: app.role,
        coverLetter: emailBody,
      },
      telegramChatId: chatId,
      source: "telegram" as const,
      applicationId: appId,
      attachResume: hasResume,
    })

    const replyButtons: { text: string; callback_data: string }[][] = [
      [
        { text: "✅ Send to Recruiter", callback_data: `approve:${pendingActionId}` },
        { text: "❌ Skip", callback_data: `reject:${pendingActionId}` },
      ],
    ]
    if (hasResume) {
      replyButtons.push([
        { text: "📎 Resume: ON", callback_data: `toggle_resume:${pendingActionId}` },
      ])
    }

    const attachLine = hasResume ? "\n📎 <b>Resume will be attached</b>" : ""
    const preview = emailBody.length > 500 ? emailBody.slice(0, 500) + "..." : emailBody

    const result = (await sendMessage(
      botToken, chatId,
      `✅ <b>Calendar event created!</b>\n\n` +
        `<b>Interview — ${escapeHtml(app.company)} (${escapeHtml(app.role)})</b>\n` +
        `${escapeHtml(slot.label)}\n\n` +
        `📧 <b>Notify the recruiter?</b>\n` +
        `<b>To:</b> ${escapeHtml(app.recipientEmail)}${attachLine}\n\n` +
        `<b>Preview:</b>\n${escapeHtml(preview)}`,
      { inline_keyboard: replyButtons }
    )) as { result?: { message_id?: number } }

    if (result?.result?.message_id) {
      await ctx.runMutation(internal.pendingActions.setTelegramMessageId, {
        pendingActionId: pendingActionId as Id<"pendingActions">,
        telegramMessageId: String(result.result.message_id),
      })
    }
  } catch (err) {
    console.error("[telegram] cal_ev failed:", err)
    if (String(err).includes("MISSING_CALENDAR_SCOPE")) {
      const permissionsUrl =
        (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_CONVEX_SITE_URL || "") +
        "/permissions"
      await sendMessage(
        botToken, chatId,
        `🔒 <b>Calendar access not enabled</b>\n\nVisit your permissions page to connect it:\n${permissionsUrl}`
      )
    } else {
      await sendMessage(botToken, chatId, `❌ <b>Failed to create event</b>\n\n${escapeHtml(String(err))}`)
    }
  }
}

// ── Toggle resume attachment ──

async function handleToggleResume(
  ctx: ActionCtx, botToken: string, chatId: string,
  callbackQuery: CallbackQuery, data: string
) {
  const actionId = data.replace("toggle_resume:", "") as Id<"pendingActions">
  try {
    const newValue: boolean | null = await ctx.runMutation(
      internal.pendingActions.toggleAttachResume,
      { id: actionId }
    )
    if (newValue === null) {
      await answerCallbackQuery(botToken, callbackQuery.id, "Action expired.")
      return
    }

    const label = newValue ? "📎 Resume: ON" : "📎 Resume: OFF"
    await answerCallbackQuery(
      botToken, callbackQuery.id,
      newValue ? "Resume will be attached" : "Resume removed"
    )

    if (callbackQuery.message?.message_id) {
      await sendTelegram(botToken, "editMessageReplyMarkup", {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Approve & Send", callback_data: `approve:${actionId}` },
              { text: "❌ Reject", callback_data: `reject:${actionId}` },
            ],
            [
              { text: label, callback_data: `toggle_resume:${actionId}` },
            ],
          ],
        },
      })
    }
  } catch (err) {
    console.error("[telegram] toggle_resume failed:", err)
    await answerCallbackQuery(botToken, callbackQuery.id, "Failed to toggle.")
  }
}
