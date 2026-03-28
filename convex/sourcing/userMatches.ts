import { query, mutation } from "../_generated/server"
import { v } from "convex/values"

/**
 * Get all job matches for a user, optionally filtered by status.
 * Each match is joined with its full job listing data.
 */
export const getMatchesForUser = query({
  args: {
    userId: v.string(),
    status: v.optional(
      v.union(
        v.literal("new"),
        v.literal("ignored"),
        v.literal("approved"),
        v.literal("applied")
      )
    ),
  },
  handler: async (ctx, { userId, status }) => {
    let matches
    if (status) {
      matches = await ctx.db
        .query("userJobMatches")
        .withIndex("by_userId_and_status", (q) =>
          q.eq("userId", userId).eq("status", status)
        )
        .take(50)
    } else {
      matches = await ctx.db
        .query("userJobMatches")
        .withIndex("by_userId_and_status", (q) => q.eq("userId", userId))
        .take(50)
    }

    // Join with job listing data — only include jobs with a recruiter email
    const results = []
    for (const match of matches) {
      const job = await ctx.db.get(match.jobListingId)
      if (job && job.email) {
        results.push({ ...match, job })
      }
    }
    return results
  },
})

/**
 * Update a match's status (approve, ignore, etc.)
 */
export const updateStatus = mutation({
  args: {
    matchId: v.id("userJobMatches"),
    status: v.union(
      v.literal("new"),
      v.literal("ignored"),
      v.literal("approved"),
      v.literal("applied")
    ),
  },
  handler: async (ctx, { matchId, status }) => {
    await ctx.db.patch(matchId, { status, updatedAt: Date.now() })
  },
})
