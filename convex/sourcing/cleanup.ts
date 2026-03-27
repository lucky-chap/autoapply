import { internalMutation } from "../_generated/server"

export const cleanupOldJobs = internalMutation({
  handler: async (ctx) => {
    // Delete records older than 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000

    let deletedMatches = 0
    // Fetch and delete in small batches to avoid hitting transaction limits
    const oldMatches = await ctx.db
      .query("userJobMatches")
      .withIndex("by_creation_time", (q) => q.lt("_creationTime", thirtyDaysAgo))
      .take(200)

    for (const match of oldMatches) {
      await ctx.db.delete(match._id)
      deletedMatches++
    }

    let deletedJobs = 0
    const oldJobs = await ctx.db
      .query("jobListings")
      .withIndex("by_creation_time", (q) => q.lt("_creationTime", thirtyDaysAgo))
      .take(200)
      
    for (const job of oldJobs) {
      await ctx.db.delete(job._id)
      deletedJobs++
    }

    if (deletedMatches > 0 || deletedJobs > 0) {
      console.log(`[Job Board Cleanup]: Removed ${deletedMatches} matches and ${deletedJobs} listings older than 30 days.`)
    }
  }
})
