import { internalAction } from "../_generated/server"
import { internal } from "../_generated/api"
import { Id } from "../_generated/dataModel"

/**
 * Main cron entry point: polls job boards for all active users.
 *
 * Strategy:
 *  1. Collect distinct targetRoles across all onboarded users.
 *  2. Fetch jobs from Remotive + HN "Who is Hiring" (deduplicated).
 *  3. Prioritize jobs with emails for AI matching (saves Gemini budget).
 *  4. Evaluate jobs against each user's profile via AI matcher.
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

    // 2. Collect unique search terms from all users' target roles
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
      console.log("JobBoard cron: no target roles configured, skipping")
      return
    }

    // 3. Fetch from all sources
    // 3a. Remotive — one search per unique role
    for (const role of Array.from(allRoles)) {
      await ctx.runAction(internal.sourcing.remotive.fetchAndStore, {
        search: role,
        limit: 30,
      })
    }

    // 3b. HN "Who is Hiring" — monthly thread, idempotent (deduped by commentId)
    await ctx.runAction(internal.sourcing.hackernews.fetchAndStore, {})

    // 4. Get jobs to evaluate, prioritizing those with emails
    // Email jobs get 80% of the AI budget (auto-apply-able),
    // plus a small batch of no-email jobs for manual-mode users.
    const emailJobs: Array<{ _id: Id<"jobListings"> }> = await ctx.runQuery(
      internal.sourcing.store.getLatestListingsWithEmail,
      { limit: 8 }
    )
    const allJobs: Array<{ _id: Id<"jobListings"> }> = await ctx.runQuery(
      internal.sourcing.store.getLatestListings,
      { limit: 2 }
    )

    // Merge and deduplicate
    const seenIds = new Set<string>()
    const latestJobs: Array<{ _id: Id<"jobListings"> }> = []
    for (const job of [...emailJobs, ...allJobs]) {
      if (!seenIds.has(job._id)) {
        seenIds.add(job._id)
        latestJobs.push(job)
      }
    }

    if (latestJobs.length === 0) {
      console.log("JobBoard cron: no jobs in database to evaluate")
      return
    }

    const jobIdsToEvaluate = latestJobs.map((j) => j._id)
    console.log(`JobBoard cron: Evaluating ${jobIdsToEvaluate.length} jobs for ${activeUsers.length} users`)

    // 5. Match jobs against each user
    // Wrap in try/catch so a timeout or error in matching doesn't prevent
    // dispatching already-created matches from this or previous cycles.
    for (const user of activeUsers) {
      try {
        await ctx.runAction(
          internal.sourcing.aiMatching.evaluateJobsForUser,
          {
            userId: user.userId,
            jobIds: jobIdsToEvaluate,
          }
        )
      } catch (e) {
        console.error(`AI matching failed for ${user.userId}:`, e)
      }
    }

    // 6. Dispatch top matches to Telegram for each user
    // This always runs, even if matching partially failed above,
    // so any matches created before the error still get sent.
    for (const user of activeUsers) {
      try {
        await ctx.runAction(
          internal.sourcing.telegramNotify.dispatchMatchesToTelegram,
          { userId: user.userId }
        )
      } catch (e) {
        console.error(`Telegram dispatch failed for ${user.userId}:`, e)
      }
    }

    console.log("JobBoard cron: cycle complete")
  },
})

// ---- Helper queries registered in this file for cron access ----

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
