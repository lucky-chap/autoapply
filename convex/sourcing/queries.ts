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

export const getProspectById = internalQuery({
  args: { prospectId: v.id("prospects") },
  handler: async (ctx, { prospectId }) => {
    return await ctx.db.get(prospectId)
  },
})

export const getMatchById = internalQuery({
  args: { matchId: v.id("userJobMatches") },
  handler: async (ctx, { matchId }) => {
    return await ctx.db.get(matchId)
  },
})

