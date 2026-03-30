import {
  query,
  mutation,
  internalMutation,
} from "./_generated/server"
import { v } from "convex/values"

export const create = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique()

    if (!user) throw new Error("User not found")

    const today = new Date().toISOString().split("T")[0]

    // Check if session already exists for today
    const existing = await ctx.db
      .query("standupSessions")
      .withIndex("by_userId_and_date", (q) =>
        q.eq("userId", user._id).eq("date", today)
      )
      .unique()

    if (existing) return existing._id

    return await ctx.db.insert("standupSessions", {
      userId: user._id,
      date: today,
      status: "gathering",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
})

export const getToday = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique()

    if (!user) return null

    const today = new Date().toISOString().split("T")[0]

    return await ctx.db
      .query("standupSessions")
      .withIndex("by_userId_and_date", (q) =>
        q.eq("userId", user._id).eq("date", today)
      )
      .unique()
  },
})

export const getRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique()

    if (!user) return []

    return await ctx.db
      .query("standupSessions")
      .withIndex("by_userId_and_date", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit ?? 10)
  },
})

export const updateContent = internalMutation({
  args: {
    sessionId: v.id("standupSessions"),
    githubActivity: v.optional(v.string()),
    generatedContent: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("gathering"),
        v.literal("drafting"),
        v.literal("ready"),
        v.literal("distributed")
      )
    ),
  },
  handler: async (ctx, { sessionId, ...updates }) => {
    const patch: Record<string, unknown> = { updatedAt: Date.now() }
    if (updates.githubActivity !== undefined)
      patch.githubActivity = updates.githubActivity
    if (updates.generatedContent !== undefined)
      patch.generatedContent = updates.generatedContent
    if (updates.status !== undefined) patch.status = updates.status

    await ctx.db.patch(sessionId, patch)
  },
})

export const updateStatus = internalMutation({
  args: {
    sessionId: v.id("standupSessions"),
    status: v.union(
      v.literal("gathering"),
      v.literal("drafting"),
      v.literal("ready"),
      v.literal("distributed")
    ),
  },
  handler: async (ctx, { sessionId, status }) => {
    await ctx.db.patch(sessionId, { status, updatedAt: Date.now() })
  },
})
