import { internalAction } from "../_generated/server"
import { internal } from "../_generated/api"
import { v } from "convex/values"
import { Id } from "../_generated/dataModel"
import type { ActionCtx } from "../_generated/server"

/**
 * Main cron entry point: polls job boards for all active users.
 *
 * Strategy:
 *  1. Collect distinct targetRoles across all onboarded users.
 *  2. Run pipeline diagnostic per user (log warnings for blocked gates).
 *  3. Fetch jobs from Remotive + HN "Who is Hiring" (deduplicated).
 *  4. Prioritize jobs with emails for AI matching (saves Gemini budget).
 *  5. Evaluate jobs against each user's profile via AI matcher.
 *  6. Alert via Telegram when auto-mode users get zero dispatches.
 */
export const pollJobBoards = internalAction({
  args: {},
  handler: async (ctx) => {
    // 1. Get all users who have completed onboarding
    const activeUsers = await ctx.runQuery(
      internal.sourcing.cron.getActiveUsers
    )
    if (activeUsers.length === 0) {
      console.log("JobBoard cron: no active users, skipping")
      return
    }

    console.log(`JobBoard cron: ${activeUsers.length} active user(s)`)

    // 2. Run pipeline diagnostic for each user
    const userDiags: Record<string, PipelineDiagnostic> = {}
    for (const user of activeUsers) {
      const diag: PipelineDiagnostic = await ctx.runQuery(
        internal.sourcing.cron.getPipelineDiagnostic,
        { userId: user.userId }
      )
      userDiags[user.userId] = diag
      const issues = getDiagnosticIssues(diag)
      if (issues.length > 0) {
        console.warn(`[Pipeline] ${user.userId}: ${issues.join(", ")}`)
      } else {
        console.log(`[Pipeline] ${user.userId}: all gates OK`)
      }
    }

    // 3. Collect unique search terms from all users' target roles
    const allRoles = new Set<string>()
    const userRolesMap: Record<string, string[]> = {}

    for (const user of activeUsers) {
      const prefs = await ctx.runQuery(
        internal.preferences.getByUserInternal,
        { userId: user.userId }
      )
      const roles = prefs?.targetRoles ?? []
      userRolesMap[user.userId] = roles
      for (const role of roles) {
        allRoles.add(role.toLowerCase().trim())
      }
    }

    if (allRoles.size === 0) {
      console.warn("JobBoard cron: no target roles configured, skipping")
      for (const user of activeUsers) {
        await alertUserIfLinked(
          ctx,
          user.userId,
          "No target roles configured — the job sourcing pipeline is idle.\n\nSet your target roles on the web app to start receiving matches."
        )
      }
      return
    }

    // 4. Fetch from all sources
    // 4a. Remotive — one search per unique role
    for (const role of Array.from(allRoles)) {
      await ctx.runAction(internal.sourcing.remotive.fetchAndStore, {
        search: role,
        limit: 30,
      })
    }

    // 4b. HN "Who is Hiring" — monthly thread, idempotent (deduped by commentId)
    await ctx.runAction(internal.sourcing.hackernews.fetchAndStore, {})

    // 4c. Arbeitnow — broad tech job listings (no search filter, deduped by slug)
    await ctx.runAction(internal.sourcing.arbeitnow.fetchAndStore, {
      limit: 100,
    })

    // 5–6. Per-user: find unevaluated jobs, then run AI matching.
    // Uses getUnevaluatedJobsForUser so the pipeline drains ALL stored
    // jobs over time instead of re-querying the same already-matched ones.
    for (const user of activeUsers) {
      try {
        const emailJobs: Array<{ _id: Id<"jobListings"> }> = await ctx.runQuery(
          internal.sourcing.store.getUnevaluatedJobsForUser,
          { userId: user.userId, limit: 20, requireEmail: true }
        )
        const anyJobs: Array<{ _id: Id<"jobListings"> }> = await ctx.runQuery(
          internal.sourcing.store.getUnevaluatedJobsForUser,
          { userId: user.userId, limit: 10 }
        )

        // Merge and deduplicate
        const seenIds = new Set<string>()
        const jobIds: Id<"jobListings">[] = []
        for (const job of [...emailJobs, ...anyJobs]) {
          if (!seenIds.has(job._id)) {
            seenIds.add(job._id)
            jobIds.push(job._id)
          }
        }

        if (jobIds.length === 0) {
          console.log(`JobBoard cron: no unevaluated jobs for ${user.userId}`)
          continue
        }

        console.log(`JobBoard cron: Evaluating ${jobIds.length} unevaluated jobs for ${user.userId}`)

        await ctx.runAction(
          internal.sourcing.aiMatching.evaluateJobsForUser,
          { userId: user.userId, jobIds }
        )
      } catch (e) {
        console.error(`AI matching failed for ${user.userId}:`, e)
      }
    }

    // 7. Dispatch top matches to Telegram for each user
    // This always runs, even if matching partially failed above,
    // so any matches created before the error still get sent.
    let totalDispatched = 0
    for (const user of activeUsers) {
      try {
        const dispatched: number = await ctx.runAction(
          internal.sourcing.telegramNotify.dispatchMatchesToTelegram,
          { userId: user.userId }
        )
        totalDispatched += dispatched
      } catch (e) {
        console.error(`Telegram dispatch failed for ${user.userId}:`, e)
      }
    }

    // 8. Alert users who got zero dispatches — only for config issues,
    // NOT for "no matching jobs" which is normal and expected most cycles.
    if (totalDispatched === 0) {
      console.warn("JobBoard cron: cycle complete with ZERO dispatches")
      for (const user of activeUsers) {
        const diag = userDiags[user.userId]
        if (diag?.hasTelegramLink) {
          const issues = getDiagnosticIssues(diag).filter(
            (i) => !i.includes("No matching jobs found")
          )
          if (issues.length > 0) {
            await alertUserIfLinked(
              ctx,
              user.userId,
              `Pipeline issue detected:\n${issues.map((i) => `- ${i}`).join("\n")}\n\n` +
                `Use /status to see your full pipeline health.`
            )
          }
        }
      }
    } else {
      console.log(`JobBoard cron: cycle complete, ${totalDispatched} match(es) dispatched`)
    }
  },
})

// ── Pipeline diagnostic types & helpers ──

interface PipelineDiagnostic {
  hasResumeProfile: boolean
  hasTargetRoles: boolean
  hasTelegramLink: boolean
  hasGmailToken: boolean
  pendingMatchCount: number
  recentMatchCount: number
  failedActionCount: number
}

function getDiagnosticIssues(diag: PipelineDiagnostic): string[] {
  const issues: string[] = []
  if (!diag.hasResumeProfile) issues.push("No resume uploaded")
  if (!diag.hasTargetRoles) issues.push("No target roles configured")
  if (!diag.hasTelegramLink) issues.push("Telegram not linked")
  if (!diag.hasGmailToken) issues.push("Gmail not connected (re-auth needed)")
  if (diag.pendingMatchCount === 0 && diag.recentMatchCount === 0) {
    issues.push("No matching jobs found this cycle")
  }
  if (diag.failedActionCount > 0) {
    issues.push(`${diag.failedActionCount} email send(s) failed recently`)
  }
  return issues
}

async function alertUserIfLinked(
  ctx: ActionCtx,
  userId: string,
  message: string
) {
  const link = await ctx.runQuery(
    internal.telegramLinks.getLinkByUserIdInternal,
    { userId }
  )
  if (!link) return
  try {
    await ctx.runAction(internal.telegram.sendNotification, {
      chatId: link.telegramChatId,
      text: `\u26a0\ufe0f <b>Pipeline Alert</b>\n\n${message}`,
    })
  } catch (e) {
    console.error(`Failed to send pipeline alert to ${userId}:`, e)
  }
}

// ---- Helper queries ----

import { internalQuery } from "../_generated/server"

export const getActiveUsers = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Get all users who have completed onboarding
    const all = await ctx.db
      .query("userSettings")
      .take(200)
    return all.filter((u) => u.onboardingCompleted === true)
  },
})

/**
 * Pipeline health diagnostic for a single user.
 * Checks every gate that can silently block auto-apply.
 */
export const getPipelineDiagnostic = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const profile = await ctx.db
      .query("resumeProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first()

    const prefs = await ctx.db
      .query("preferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first()

    const telegramLink = await ctx.db
      .query("telegramLinks")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()

    const tokenData = await ctx.db
      .query("userTokens")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()

    // Count unnotified "new" matches (pending dispatch)
    const pendingMatches = await ctx.db
      .query("userJobMatches")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", userId).eq("status", "new")
      )
      .take(100)
    const pendingMatchCount = pendingMatches.filter(
      (m) => m.telegramNotified !== true
    ).length

    // Count recent matches (last 24h)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
    const recentMatchCount = pendingMatches.filter(
      (m) => m.createdAt > oneDayAgo
    ).length

    // Count failed actions in last 24h
    const failedActions = await ctx.db
      .query("pendingActions")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", userId).eq("status", "failed")
      )
      .take(50)
    const failedActionCount = failedActions.filter(
      (a) => a.createdAt > oneDayAgo
    ).length

    return {
      hasResumeProfile: profile !== null,
      hasTargetRoles: (prefs?.targetRoles?.length ?? 0) > 0,
      hasTelegramLink: telegramLink !== null,
      hasGmailToken: tokenData?.auth0RefreshToken != null,
      pendingMatchCount,
      recentMatchCount,
      failedActionCount,
    }
  },
})
