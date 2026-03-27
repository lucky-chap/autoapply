/**
 * Job description processing and application flow.
 *
 * Handles: extracting job info, salary checks, cover letter generation,
 * creating pending actions (with or without auto-mode), and the
 * pending-action preview message.
 */

import { ActionCtx } from "./_generated/server"
import { internal } from "./_generated/api"
import { Id } from "./_generated/dataModel"
import { extractJobInfoHelper, generateCoverLetterHelper } from "./aiActions"
import { formatApplicationSent } from "./openclaw"
import { escapeHtml, sendMessage } from "./telegramHelpers"

// ── Create pending action and send preview to Telegram ──

export async function createPendingActionAndPreview(
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
  },
  options?: { applicationId?: Id<"applications">; attachResume?: boolean }
) {
  const profile = await ctx.runQuery(
    internal.resumeProfiles.getByUserInternal,
    { userId }
  )
  const hasResume = !!profile?.fileId
  const attachResume = hasResume && (options?.attachResume ?? true)

  const pendingActionId = await ctx.runMutation(
    internal.pendingActions.create,
    {
      userId,
      actionType: "send_email" as const,
      payload,
      telegramChatId: chatId,
      source: "telegram" as const,
      applicationId: options?.applicationId,
      attachResume,
    }
  )

  const preview =
    payload.coverLetter.length > 500
      ? payload.coverLetter.slice(0, 500) + "..."
      : payload.coverLetter

  const attachLabel = attachResume ? "📎 Resume: ON" : "📎 Resume: OFF"
  const buttons: { text: string; callback_data: string }[][] = [
    [
      { text: "✅ Approve & Send", callback_data: `approve:${pendingActionId}` },
      { text: "❌ Reject", callback_data: `reject:${pendingActionId}` },
    ],
  ]
  if (hasResume) {
    buttons.push([
      { text: attachLabel, callback_data: `toggle_resume:${pendingActionId}` },
    ])
  }

  const attachLine = attachResume ? "\n📎 <b>Resume will be attached</b>" : ""

  const result = (await sendMessage(
    botToken,
    chatId,
    `📧 <b>Ready to send application</b>\n\n` +
      `<b>Company:</b> ${escapeHtml(payload.company)}\n` +
      `<b>Role:</b> ${escapeHtml(payload.role)}\n` +
      `<b>To:</b> ${escapeHtml(payload.to)}${attachLine}\n\n` +
      `<b>Cover Letter Preview:</b>\n${escapeHtml(preview)}`,
    { inline_keyboard: buttons }
  )) as { result?: { message_id?: number } }

  if (result?.result?.message_id) {
    await ctx.runMutation(internal.pendingActions.setTelegramMessageId, {
      pendingActionId: pendingActionId as Id<"pendingActions">,
      telegramMessageId: String(result.result.message_id),
    })
  }
}

// ── Process job description text ──

export async function processJobDescription(
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
    await sendMessage(botToken, chatId, `❌ Failed to process job description: ${String(err)}`)
    return
  }

  if (jobInfo.multipleDetected) {
    await sendMessage(
      botToken, chatId,
      "⚠️ It looks like you pasted <b>multiple job postings</b> in one message.\n\n" +
        "Please send them <b>one at a time</b> so I can process each correctly."
    )
    return
  }

  if (!jobInfo.company && !jobInfo.role) {
    await sendMessage(
      botToken, chatId,
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
      botToken, chatId,
      `📝 Found: <b>${escapeHtml(jobInfo.company)}</b> — <b>${escapeHtml(jobInfo.role)}</b>\n\n` +
        "⚠️ No contact email found in the posting. Please reply with the recruiter's email address."
    )
    return
  }

  // Check salary against user preferences
  const prefs = await ctx.runQuery(internal.preferences.getByUserInternal, { userId })
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
      botToken, chatId,
      `💰 <b>Salary alert</b>\n\n` +
        `<b>${escapeHtml(jobInfo.company)}</b> — ${escapeHtml(jobInfo.role)}\n` +
        `Listed salary: <b>${formatSalary(jobInfo.salary)}</b>\n` +
        `Your minimum: <b>${formatSalary(prefs.minSalary)}</b>\n\n` +
        `This role pays <b>${formatSalary(prefs.minSalary - jobInfo.salary)}</b> below your minimum. Do you still want to apply?`,
      {
        inline_keyboard: [
          [
            { text: "✅ Apply anyway", callback_data: `salary_proceed:${reviewId}` },
            { text: "⏭ Skip", callback_data: `salary_skip:${reviewId}` },
          ],
        ],
      }
    )
    return
  }

  await continueWithApplication(
    ctx, botToken, chatId, userId,
    text, jobInfo.company, jobInfo.role, jobInfo.email
  )
}

// ── Continue with application (after all checks pass) ──

export async function continueWithApplication(
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
      ctx, jobDescription, company, role, userId
    )
  } catch (err) {
    await sendMessage(botToken, chatId, `❌ Failed to generate cover letter: ${String(err)}`)
    return
  }

  const subject = `Application for ${role} at ${company}`
  const payload = {
    to: email,
    subject,
    body: coverLetter,
    company,
    role,
    coverLetter,
  }

  // Check if auto mode is enabled
  const settings = await ctx.runQuery(
    internal.userSettings.getByUserInternal,
    { userId }
  )

  if (settings?.autoMode) {
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
    await ctx.runMutation(internal.pendingActions.internalApprove, {
      id: pendingActionId as Id<"pendingActions">,
    })
    await sendMessage(
      botToken, chatId,
      `🤖 <b>Auto Mode</b> — Sending application to <b>${escapeHtml(company)}</b> (${escapeHtml(role)})...`
    )
    await ctx.runAction(internal.openclaw.sendNotification, {
      userId,
      message: formatApplicationSent(company, role),
    })
  } else {
    await createPendingActionAndPreview(ctx, botToken, chatId, userId, payload)
  }
}
