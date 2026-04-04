import { internalAction, internalMutation } from "../_generated/server"
import { v } from "convex/values"
import { internal } from "../_generated/api"
import { Id } from "../_generated/dataModel"
import { inferDecisionMakerRoles } from "../../lib/outreach/roleMapper"
import { extractDomain } from "../../lib/outreach/domainUtils"

/**
 * Run the outreach pipeline for a matched job.
 *
 * When called with `telegramChatId`, the pending action is linked to Telegram
 * and a notification with Approve/Reject buttons is sent to the user.
 * When called without it (e.g. from tests), the action is web-only.
 */
export const runPipelineForMatch = internalAction({
  args: {
    userId: v.string(),
    jobListingId: v.id("jobListings"),
    matchId: v.id("userJobMatches"),
    overrideDomain: v.optional(v.string()),
    overrideRoles: v.optional(v.array(v.string())),
    telegramChatId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { userId, jobListingId, matchId, overrideDomain, overrideRoles, telegramChatId }
  ) => {
    const job = await ctx.runQuery(internal.sourcing.queries.getJobById, {
      jobId: jobListingId,
    })
    if (!job) return

    // Guard: prevent duplicate applications for the same job
    const alreadyApplied: boolean = await ctx.runQuery(
      internal.applications.hasApplicationForJob,
      { userId, jobListingId }
    )
    if (alreadyApplied) {
      console.log(`Skipping ${job.company} - ${job.title}: already applied`)
      if (telegramChatId) {
        await ctx.runAction(internal.telegram.sendNotification, {
          chatId: telegramChatId,
          text: `ℹ️ Already applied to <b>${escapeHtml(job.title)}</b> at <b>${escapeHtml(job.company)}</b>.`,
        })
      }
      return
    }

    console.log(`Starting outreach pipeline for ${job.company} - ${job.title}`)

    // Helper: create pending action and optionally notify on Telegram
    async function createPendingAndNotify(
      email: string,
      subject: string,
      body: string,
    ) {
      const source = telegramChatId ? "telegram" as const : "web" as const
      const pendingActionId: Id<"pendingActions"> = await ctx.runMutation(
        internal.pendingActions.create,
        {
          userId,
          actionType: "send_email",
          payload: {
            to: email,
            subject,
            body,
            company: job!.company,
            role: job!.title,
            coverLetter: body,
          },
          source,
          telegramChatId,
          applicationId: undefined,
          jobListingId,
          attachResume: true,
        }
      )

      if (telegramChatId) {
        await ctx.runAction(
          internal.outreach.orchestrator.notifyTelegramPendingAction,
          {
            chatId: telegramChatId,
            pendingActionId,
            email,
            subject,
            body,
            company: job!.company,
            role: job!.title,
          }
        )
      }
    }

    // Fast path: use email from the job post directly (common in HN "Who's Hiring")
    if (job.email) {
      console.log(`Using job post email directly: ${job.email}`)

      const prospectId = await ctx.runMutation(
        internal.outreach.mutations.insertProspect,
        {
          userId,
          jobListingId,
          name: "Hiring Contact",
          email: job.email,
          title: job.title,
          company: job.company,
          source: "job_post",
          status: "verified",
        }
      )

      const draft = await ctx.runAction(
        internal.outreach.generator.generateOutreachEmail,
        { userId, jobListingId, prospectId }
      )

      await createPendingAndNotify(job.email, draft.subject, draft.body)

      console.log(
        `Direct-email outreach draft created for ${job.company} (${job.email})`
      )
      return
    }

    // Enrichment fallback: find decision-maker contacts via Tomba → pattern emails
    const targetRoles = overrideRoles || inferDecisionMakerRoles(job.title)
    const companyDomain =
      overrideDomain || job.domain || extractDomain(job.url, job.company)

    console.log(
      `Using domain: ${companyDomain} and searching for roles: ${targetRoles.join(", ")}`
    )

    // Search Tomba.io (free: 25 searches/month)
    let prospects = await ctx.runAction(
      internal.enrichment.tomba.searchPeople,
      { domain: companyDomain, titles: targetRoles, limit: 3 }
    )

    if (prospects.length === 0 && companyDomain) {
      console.log(
        `No prospects found via enrichment for ${job.company}, using pattern email fallback`
      )
      const { generateHiringEmails } = await import(
        "../../lib/outreach/patternEmails"
      )
      const patternEmails = generateHiringEmails(companyDomain)
      if (patternEmails.length > 0) {
        const fallbackEmail = patternEmails[0]
        console.log(`Using pattern email fallback: ${fallbackEmail}`)

        const prospectId = await ctx.runMutation(
          internal.outreach.mutations.insertProspect,
          {
            userId,
            jobListingId,
            name: "Hiring Team",
            email: fallbackEmail,
            title: "Hiring Contact",
            company: job.company,
            source: "manual",
            status: "new",
          }
        )

        const draft = await ctx.runAction(
          internal.outreach.generator.generateOutreachEmail,
          { userId, jobListingId, prospectId }
        )

        await createPendingAndNotify(fallbackEmail, draft.subject, draft.body)

        console.log(
          `Pattern-email outreach draft created for ${job.company} (${fallbackEmail})`
        )
        return
      }
    }

    if (prospects.length === 0) {
      console.log(`No prospects found for ${job.company} (no domain available)`)
      if (telegramChatId) {
        await ctx.runAction(internal.telegram.sendNotification, {
          chatId: telegramChatId,
          text: `⚠️ <b>Could not find a contact email</b> for ${escapeHtml(job.title)} at ${escapeHtml(job.company)}.\n\n` +
            `<a href="${escapeHtml(job.url)}">Apply directly via the listing</a>`,
        })
      }
      return
    }

    // Store first good prospect and create outreach draft
    for (const p of prospects) {
      if (!p.email) {
        console.log(`Email missing for prospect: ${p.name}, skipping...`)
        continue
      }

      console.log(`Selected prospect: ${p.name} (${p.title}) - ${p.email}`)

      const prospectId = await ctx.runMutation(
        internal.outreach.mutations.insertProspect,
        {
          userId,
          jobListingId,
          name: p.name,
          email: p.email,
          title: p.title,
          company: p.company,
          seniority: p.seniority,
          department: p.department,
          source: p.source,
          status: "verified",
          enrichmentData: p.raw,
        }
      )

      const draft = await ctx.runAction(
        internal.outreach.generator.generateOutreachEmail,
        { userId, jobListingId, prospectId }
      )

      await createPendingAndNotify(p.email, draft.subject, draft.body)

      console.log(`Outreach draft created for ${p.name} at ${job.company}`)
      break
    }
  },
})

/**
 * Send a Telegram notification for a newly created pending action
 * with Approve/Reject buttons.
 */
export const notifyTelegramPendingAction = internalAction({
  args: {
    chatId: v.string(),
    pendingActionId: v.id("pendingActions"),
    email: v.string(),
    subject: v.string(),
    body: v.string(),
    company: v.string(),
    role: v.string(),
  },
  handler: async (ctx, { chatId, pendingActionId, email, subject, body, company, role }) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN!
    const siteUrl =
      process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || ""

    const preview = body.length > 500 ? body.slice(0, 500) + "…" : body

    const buttons: { text: string; url?: string; callback_data?: string }[][] = [
      [
        { text: "✅ Approve & Send", url: `${siteUrl}/api/telegram/approve?action=${pendingActionId}` },
        { text: "❌ Reject", callback_data: `reject:${pendingActionId}` },
      ],
      [
        { text: "📎 Resume: ON", callback_data: `toggle_resume:${pendingActionId}` },
      ],
    ]

    const { sendMessage } = await import("../telegramHelpers")

    const result = (await sendMessage(
      botToken,
      chatId,
      `📧 <b>Ready to apply</b>\n\n` +
        `<b>${escapeHtml(role)}</b> at <b>${escapeHtml(company)}</b>\n` +
        `<b>To:</b> ${escapeHtml(email)}\n` +
        `<b>Subject:</b> ${escapeHtml(subject)}\n` +
        `📎 <b>Resume will be attached</b>\n\n` +
        `<b>Preview:</b>\n${escapeHtml(preview)}`,
      { inline_keyboard: buttons }
    )) as { result?: { message_id?: number } }

    if (result?.result?.message_id) {
      await ctx.runMutation(internal.pendingActions.setTelegramMessageId, {
        pendingActionId,
        telegramMessageId: String(result.result.message_id),
      })
    }
  },
})

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
