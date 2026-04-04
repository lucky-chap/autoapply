/**
 * Smart interview scheduling — handles the auto-scheduling logic
 * that runs when the inbox checker detects an "Interview" status reply.
 *
 * Two scenarios:
 *  A) Recruiter proposed specific times → pick the first available,
 *     create a calendar event, draft a confirmation email.
 *  B) No proposed times (or all conflict) → find free slots,
 *     draft an availability email.
 */

import { ActionCtx } from "./_generated/server"
import { internal } from "./_generated/api"
import { Id } from "./_generated/dataModel"
import { analyzeAvailability, parseProposedTime } from "./calendar"
import { buildApprovalButtons } from "./telegramHelpers"

interface InterviewApp {
  _id: Id<"applications">
  userId: string
  company: string
  role: string
  recipientEmail: string
}

interface NotificationContext {
  statusLine: string
  summaryLine: string
  telegramChatId: string
}

/**
 * Attempt smart scheduling for an interview reply.
 * Returns true if a Telegram notification was sent, false otherwise.
 */
export async function handleInterviewScheduling(
  ctx: ActionCtx,
  app: InterviewApp,
  proposedTimes: string[],
  notif: NotificationContext
): Promise<boolean> {
  const now = new Date()
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const calEvents = await ctx.runAction(internal.calendar.getCalendarConflicts, {
    userId: app.userId,
    startTime: now.toISOString(),
    endTime: sevenDaysLater.toISOString(),
  })

  const inboxSettings = await ctx.runQuery(
    internal.userSettings.getByUserInternal,
    { userId: app.userId }
  )

  const availability = analyzeAvailability(
    calEvents,
    proposedTimes,
    now,
    sevenDaysLater,
    inboxSettings?.availabilitySchedule ?? undefined
  )

  const profile = await ctx.runQuery(
    internal.resumeProfiles.getByUserInternal,
    { userId: app.userId }
  )
  const hasResume = !!profile?.fileId

  const availableProposed = availability.proposedTimeStatus.filter(
    (pt) => pt.available === true
  )

  // ── Scenario A: Recruiter proposed dates, at least one is free ──

  if (availableProposed.length > 0) {
    const firstAvailable = availableProposed[0]
    const parsedTime = parseProposedTime(firstAvailable.label, now)

    if (parsedTime) {
      const startTime = parsedTime.toISOString()
      const endTime = new Date(parsedTime.getTime() + 60 * 60 * 1000).toISOString()

      await ctx.runAction(internal.calendar.createCalendarEvent, {
        userId: app.userId,
        summary: `Interview — ${app.company} (${app.role})`,
        description: "Auto-scheduled via AutoApply",
        startTime,
        endTime,
      })

      const emailBody =
        `Hi,\n\n` +
        `Thank you for reaching out regarding the ${app.role} position.\n\n` +
        `I'd like to confirm that ${firstAvailable.label} works for me.\n\n` +
        `Please let me know if there's anything I should prepare.\n\n` +
        `Best regards`
      const subject = `Re: ${app.role} at ${app.company}`

      const pendingActionId = await ctx.runMutation(internal.pendingActions.create, {
        userId: app.userId,
        actionType: "send_email" as const,
        payload: {
          to: app.recipientEmail,
          subject,
          body: emailBody,
          company: app.company,
          role: app.role,
          coverLetter: emailBody,
        },
        telegramChatId: notif.telegramChatId,
        source: "telegram" as const,
        applicationId: app._id,
        attachResume: hasResume,
      })

      const preview = emailBody.length > 400 ? emailBody.slice(0, 400) + "..." : emailBody
      const attachLine = hasResume ? "\n📎 <b>Resume will be attached</b>" : ""

      const schedSiteUrl =
        process.env.NEXT_PUBLIC_CONVEX_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || ""

      const buttons: { text: string; url?: string; callback_data?: string }[][] = [
        buildApprovalButtons(schedSiteUrl, pendingActionId as string),
      ]
      if (hasResume) {
        buttons.push([
          { text: "📎 Resume: ON", callback_data: `toggle_resume:${pendingActionId}` },
        ])
      }
      buttons.push([
        { text: "📅 Check My Calendar", callback_data: `cal:${app._id}` },
      ])

      const msg =
        `📅 <b>${app.company}</b> — Interview for <b>${app.role}</b>\n\n` +
        `${notif.statusLine}${notif.summaryLine}\n\n` +
        `✅ <b>${firstAvailable.label}</b> is available!\n` +
        `📅 Calendar event created.\n\n` +
        `📧 <b>Draft reply to recruiter:</b>\n` +
        `<b>To:</b> ${app.recipientEmail}\n` +
        `<b>Subject:</b> ${subject}${attachLine}\n\n` +
        `${preview}`

      const result = (await ctx.runAction(internal.telegram.sendNotification, {
        chatId: notif.telegramChatId,
        text: msg,
        replyMarkup: { inline_keyboard: buttons },
      })) as { result?: { message_id?: number } }

      if (result?.result?.message_id) {
        await ctx.runMutation(internal.pendingActions.setTelegramMessageId, {
          pendingActionId,
          telegramMessageId: String(result.result.message_id),
        })
      }

      return true
    }
  }

  // ── Scenario B: No proposed dates, or none available ──

  await ctx.runMutation(internal.calendar.upsertCalendarSlots, {
    applicationId: app._id,
    telegramChatId: notif.telegramChatId,
    slots: availability.suggestedSlots,
    proposedTimeStatus: availability.proposedTimeStatus,
  })

  const availableTimes: string[] = [
    ...availability.proposedTimeStatus
      .filter((pt) => pt.available === true)
      .map((pt) => pt.label),
    ...availability.suggestedSlots.map((s) => s.label),
  ]

  if (availableTimes.length > 0) {
    const slotList = availableTimes.map((t) => `- ${t}`).join("\n")
    const emailBody =
      `Hi,\n\n` +
      `Thank you for getting back to me regarding the ${app.role} position.\n\n` +
      `I'm available at the following times:\n\n` +
      `${slotList}\n\n` +
      `Please let me know which works best, and I'll confirm.\n\n` +
      `Best regards`
    const subject = `Re: ${app.role} at ${app.company}`

    const pendingActionId = await ctx.runMutation(internal.pendingActions.create, {
      userId: app.userId,
      actionType: "send_email" as const,
      payload: {
        to: app.recipientEmail,
        subject,
        body: emailBody,
        company: app.company,
        role: app.role,
        coverLetter: emailBody,
      },
      telegramChatId: notif.telegramChatId,
      source: "telegram" as const,
      applicationId: app._id,
      attachResume: hasResume,
    })

    const preview = emailBody.length > 400 ? emailBody.slice(0, 400) + "..." : emailBody
    const attachLine = hasResume ? "\n📎 <b>Resume will be attached</b>" : ""

    const availSiteUrl =
      process.env.NEXT_PUBLIC_CONVEX_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || ""

    const buttons: { text: string; url?: string; callback_data?: string }[][] = [
      buildApprovalButtons(availSiteUrl, pendingActionId as string),
    ]
    if (hasResume) {
      buttons.push([
        { text: "📎 Resume: ON", callback_data: `toggle_resume:${pendingActionId}` },
      ])
    }
    buttons.push([
      { text: "📅 Block Time", callback_data: `cal_block:${app._id}` },
      { text: "📅 Check My Calendar", callback_data: `cal:${app._id}` },
    ])

    let conflictInfo = ""
    const conflicts = availability.proposedTimeStatus.filter(
      (pt) => pt.available === false
    )
    if (conflicts.length > 0) {
      conflictInfo = `\n\n❌ <b>Conflicting proposed times:</b>\n` +
        conflicts.map((c) => `- ${c.label}`).join("\n")
    }

    const msg =
      `📅 <b>${app.company}</b> — Interview for <b>${app.role}</b>\n\n` +
      `${notif.statusLine}${notif.summaryLine}${conflictInfo}\n\n` +
      `📧 <b>Draft availability reply:</b>\n` +
      `<b>To:</b> ${app.recipientEmail}\n` +
      `<b>Subject:</b> ${subject}${attachLine}\n\n` +
      `${preview}`

    const result = (await ctx.runAction(internal.telegram.sendNotification, {
      chatId: notif.telegramChatId,
      text: msg,
      replyMarkup: { inline_keyboard: buttons },
    })) as { result?: { message_id?: number } }

    if (result?.result?.message_id) {
      await ctx.runMutation(internal.pendingActions.setTelegramMessageId, {
        pendingActionId,
        telegramMessageId: String(result.result.message_id),
      })
    }

    return true
  }

  return false
}
