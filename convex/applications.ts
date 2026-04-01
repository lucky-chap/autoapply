import { query, mutation, internalMutation, internalQuery } from "./_generated/server"
import { v } from "convex/values"

// Reactive — auto-updates the UI whenever data changes
export const getByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("applications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect()
  },
})

export const create = mutation({
  args: {
    userId: v.string(),
    company: v.string(),
    role: v.string(),
    coverLetter: v.string(),
    recipientEmail: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("applications", {
      ...args,
      status: "Applied",
      emailSentAt: Date.now(),
      createdAt: Date.now(),
    })
  },
})

export const getById = query({
  args: { id: v.id("applications") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id)
  },
})

export const internalGetById = internalQuery({
  args: { id: v.id("applications") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id)
  },
})

export const getOpens = query({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, { applicationId }) => {
    return await ctx.db
      .query("emailOpens")
      .withIndex("by_applicationId", (q) => q.eq("applicationId", applicationId))
      .order("desc")
      .take(50)
  },
})

export const deleteById = mutation({
  args: { id: v.id("applications") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id)
  },
})

export const updateStatus = mutation({
  args: {
    id: v.id("applications"),
    status: v.union(
      v.literal("Applied"),
      v.literal("Replied"),
      v.literal("Interview"),
      v.literal("Offer"),
      v.literal("Rejected")
    ),
    lastCheckedGmailMsgId: v.optional(v.string()),
  },
  handler: async (ctx, { id, status, lastCheckedGmailMsgId }) => {
    await ctx.db.patch(id, {
      status,
      ...(lastCheckedGmailMsgId ? { lastCheckedGmailMsgId } : {}),
    })
  },
})

export const setThreadId = mutation({
  args: {
    id: v.id("applications"),
    gmailThreadId: v.string(),
  },
  handler: async (ctx, { id, gmailThreadId }) => {
    await ctx.db.patch(id, { gmailThreadId })
  },
})

export const recordOpen = internalMutation({
  args: {
    applicationId: v.id("applications"),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, { applicationId, userAgent }) => {
    // Deduplicate: skip if this application was opened within the last 5 minutes
    const fiveMinAgo = Date.now() - 5 * 60 * 1000
    const recentOpen = await ctx.db
      .query("emailOpens")
      .withIndex("by_applicationId", (q) => q.eq("applicationId", applicationId))
      .order("desc")
      .first()

    if (recentOpen && recentOpen.openedAt > fiveMinAgo) {
      return // Skip rapid-fire duplicate from same email view
    }

    await ctx.db.insert("emailOpens", {
      applicationId,
      openedAt: Date.now(),
      userAgent,
    })
    const app = await ctx.db.get(applicationId)
    if (app) {
      await ctx.db.patch(applicationId, {
        openCount: (app.openCount ?? 0) + 1,
      })
    }
  },
})

export const recordClick = internalMutation({
  args: {
    applicationId: v.id("applications"),
    url: v.string(),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, { applicationId, url, userAgent }) => {
    await ctx.db.insert("linkClicks", {
      applicationId,
      url,
      clickedAt: Date.now(),
      userAgent,
    })
    const app = await ctx.db.get(applicationId)
    if (app) {
      await ctx.db.patch(applicationId, {
        clickCount: (app.clickCount ?? 0) + 1,
      })
    }
  },
})

export const getClicks = query({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, { applicationId }) => {
    return await ctx.db
      .query("linkClicks")
      .withIndex("by_applicationId", (q) => q.eq("applicationId", applicationId))
      .order("desc")
      .take(50)
  },
})

export const getActiveApplications = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("applications")
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "Applied"),
          q.eq(q.field("status"), "Replied"),
          q.eq(q.field("status"), "Interview")
        )
      )
      .collect()
  },
})

export const internalCreate = internalMutation({
  args: {
    userId: v.string(),
    company: v.string(),
    role: v.string(),
    coverLetter: v.string(),
    recipientEmail: v.string(),
    source: v.optional(v.union(v.literal("web"), v.literal("telegram"))),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("applications", {
      ...args,
      status: "Applied",
      emailSentAt: Date.now(),
      createdAt: Date.now(),
    })
  },
})

export const internalSetThreadId = internalMutation({
  args: {
    id: v.id("applications"),
    gmailThreadId: v.string(),
  },
  handler: async (ctx, { id, gmailThreadId }) => {
    await ctx.db.patch(id, { gmailThreadId })
  },
})

export const getRecentByUserInternal = internalQuery({
  args: { userId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { userId, limit }) => {
    return await ctx.db
      .query("applications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit ?? 5)
  },
})

export const getApplicationsNeedingFollowUp = internalQuery({
  args: {},
  handler: async (ctx) => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    return await ctx.db
      .query("applications")
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "Applied"),
          q.lt(q.field("emailSentAt"), sevenDaysAgo),
          q.eq(q.field("followUpSentAt"), undefined)
        )
      )
      .take(50)
  },
})

export const internalSetFollowUpSent = internalMutation({
  args: { id: v.id("applications") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { followUpSentAt: Date.now() })
  },
})

export const internalUpdateStatus = internalMutation({
  args: {
    id: v.id("applications"),
    status: v.union(
      v.literal("Applied"),
      v.literal("Replied"),
      v.literal("Interview"),
      v.literal("Offer"),
      v.literal("Rejected")
    ),
    lastCheckedGmailMsgId: v.optional(v.string()),
    schedulingLink: v.optional(v.string()),
    proposedTimes: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { id, status, lastCheckedGmailMsgId, schedulingLink, proposedTimes }) => {
    await ctx.db.patch(id, {
      status,
      ...(lastCheckedGmailMsgId !== undefined ? { lastCheckedGmailMsgId } : {}),
      ...(schedulingLink !== undefined ? { schedulingLink } : {}),
      ...(proposedTimes !== undefined ? { proposedTimes } : {}),
    })
  },
})
