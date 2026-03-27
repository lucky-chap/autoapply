import { internalMutation, internalQuery } from "../_generated/server"
import { v } from "convex/values"

/**
 * Insert a job listing only if it doesn't already exist (by source + externalId).
 * Returns true if a new row was inserted.
 */
export const insertIfNew = internalMutation({
  args: {
    externalId: v.string(),
    source: v.string(),
    title: v.string(),
    company: v.string(),
    description: v.string(),
    url: v.string(),
    location: v.string(),
    salary: v.optional(v.string()),
    category: v.optional(v.string()),
    postedAt: v.optional(v.number()),
    email: v.optional(v.string()),
    hasEmail: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("jobListings")
      .withIndex("by_source_and_externalId", (q) =>
        q.eq("source", args.source).eq("externalId", args.externalId)
      )
      .first()

    if (existing) return false

    await ctx.db.insert("jobListings", {
      ...args,
      fetchedAt: Date.now(),
    })
    return true
  },
})

/**
 * Get job listings fetched after a certain timestamp.
 * Used by the matcher to find newly-inserted listings.
 */
export const getRecentListings = internalQuery({
  args: { since: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, { since, limit }) => {
    return await ctx.db
      .query("jobListings")
      .withIndex("by_fetchedAt", (q) => q.gt("fetchedAt", since))
      .take(limit ?? 100)
  },
})

/**
 * Check if a user already has a match for a specific job listing.
 */
export const hasMatch = internalQuery({
  args: {
    userId: v.string(),
    jobListingId: v.id("jobListings"),
  },
  handler: async (ctx, { userId, jobListingId }) => {
    const existing = await ctx.db
      .query("userJobMatches")
      .withIndex("by_userId_and_jobListingId", (q) =>
        q.eq("userId", userId).eq("jobListingId", jobListingId)
      )
      .first()
    return existing !== null
  },
})

/**
 * Create a new user job match record.
 */
export const createMatch = internalMutation({
  args: {
    userId: v.string(),
    jobListingId: v.id("jobListings"),
    matchScore: v.optional(v.number()),
    matchReasoning: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("new"),
        v.literal("ignored"),
        v.literal("approved"),
        v.literal("applied")
      )
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    await ctx.db.insert("userJobMatches", {
      userId: args.userId,
      jobListingId: args.jobListingId,
      status: args.status ?? "new",
      matchScore: args.matchScore,
      matchReasoning: args.matchReasoning,
      createdAt: now,
      updatedAt: now,
    })
  },
})

/**
 * Get the most recent job listings regardless of fetch time.
 */
export const getLatestListings = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    return await ctx.db
      .query("jobListings")
      .order("desc")
      .take(limit ?? 50)
  },
})

/**
 * Get the most recent job listings that have a recruiter email.
 */
export const getLatestListingsWithEmail = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    return await ctx.db
      .query("jobListings")
      .withIndex("by_hasEmail_and_fetchedAt", (q) => q.eq("hasEmail", true))
      .order("desc")
      .take(limit ?? 50)
  },
})

/**
 * Update the status of a user job match.
 */
export const updateMatchStatus = internalMutation({
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

/**
 * Get the top N new matches for a user, sorted by matchScore desc.
 * Returns matches joined with their job listing data.
 */
export const getTopNewMatches = internalQuery({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
    requireEmail: v.optional(v.boolean()),
  },
  handler: async (ctx, { userId, limit, requireEmail }) => {
    const matches = await ctx.db
      .query("userJobMatches")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", userId).eq("status", "new")
      )
      .collect()

    // Join with job data, optionally filtering to only jobs with emails
    const results = []
    for (const match of matches) {
      const job = await ctx.db.get(match.jobListingId)
      if (job) {
        if (requireEmail && !job.email) continue
        results.push({ ...match, job })
      }
    }

    // Sort by matchScore descending
    results.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
    return results.slice(0, limit ?? 5)
  },
})

/**
 * Get the top N unnotified matches for a user, sorted by matchScore desc.
 * Used exclusively by the telegram dispatcher to prevent spamming the user
 * with exactly the same matches.
 */
export const getTopUnnotifiedMatches = internalQuery({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
    requireEmail: v.optional(v.boolean()),
  },
  handler: async (ctx, { userId, limit, requireEmail }) => {
    const matches = await ctx.db
      .query("userJobMatches")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", userId).eq("status", "new")
      )
      .collect()

    const unnotifiedMatches = matches.filter(m => m.telegramNotified !== true)

    // Join with job data, optionally filtering to only jobs with emails
    const results = []
    for (const match of unnotifiedMatches) {
      const job = await ctx.db.get(match.jobListingId)
      if (job) {
        if (requireEmail && !job.email) continue
        results.push({ ...match, job })
      }
    }

    // Sort by matchScore descending
    results.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
    return results.slice(0, limit ?? 20)
  },
})

/**
 * Mark a list of matches as notified on telegram to prevent duplicates.
 */
export const markAsNotified = internalMutation({
  args: { matchIds: v.array(v.id("userJobMatches")) },
  handler: async (ctx, { matchIds }) => {
    for (const matchId of matchIds) {
      await ctx.db.patch(matchId, { telegramNotified: true, updatedAt: Date.now() })
    }
  }
})
