import { internalQuery } from "../_generated/server"
import { v } from "convex/values"

/**
 * Get a single job listing by its ID.
 * Used by the AI matching action.
 */
export const getJobById = internalQuery({
  args: { jobId: v.id("jobListings") },
  handler: async (ctx, { jobId }) => {
    return await ctx.db.get(jobId)
  },
})

/**
 * Get a single user job match by its ID.
 * Used by the Telegram callback handler.
 */
export const getMatchById = internalQuery({
  args: { matchId: v.id("userJobMatches") },
  handler: async (ctx, { matchId }) => {
    return await ctx.db.get(matchId)
  },
})

