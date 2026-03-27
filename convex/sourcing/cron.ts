import { internalAction } from "../_generated/server"
import { internal } from "../_generated/api"
import { Id } from "../_generated/dataModel"

/**
 * Main cron entry point: polls job boards for all active users.
 *
 * Strategy:
 *  1. Collect distinct targetRoles across all onboarded users.
 *  2. Fetch jobs from Remotive for each unique role keyword (deduplicated).
 *  3. Evaluate newly-fetched jobs against each user's profile via AI matcher.
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

    // 3. Fetch from Remotive for each unique role (deduplicated globally)
    const fetchBefore = Date.now()
    for (const role of Array.from(allRoles)) {
      await ctx.runAction(internal.sourcing.remotive.fetchAndStore, {
        search: role,
        limit: 30,
      })
    }

    // 4. Get the latest jobs from the database to evaluate
    // Even if 0 were *inserted* this cycle, we check the latest ~50 to ensure
    // all users have been matched against them.
    const latestJobs: Array<{ _id: Id<"jobListings"> }> = await ctx.runQuery(
      internal.sourcing.store.getLatestListings,
      { limit: 50 }
    )

    if (latestJobs.length === 0) {
      console.log("JobBoard cron: no jobs in database to evaluate")
      return
    }

    const jobIdsToEvaluate = latestJobs.map((j) => j._id)
    console.log(`JobBoard cron: Evaluating ${jobIdsToEvaluate.length} jobs for ${activeUsers.length} users`)

    // 5. Match jobs against each user
    for (const user of activeUsers) {
      await ctx.runAction(
        internal.sourcing.aiMatching.evaluateJobsForUser,
        {
          userId: user.userId,
          jobIds: jobIdsToEvaluate,
        }
      )
    }

    // 6. Dispatch top matches to Telegram for each user
    for (const user of activeUsers) {
      await ctx.runAction(
        internal.sourcing.telegramNotify.dispatchMatchesToTelegram,
        { userId: user.userId }
      )
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
    return await ctx.db
      .query("userSettings")
      .take(200)
  },
})
