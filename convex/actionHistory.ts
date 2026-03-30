import { query, internalMutation } from "./_generated/server"
import { v } from "convex/values"

export const record = internalMutation({
  args: {
    actionId: v.id("agentActions"),
    userId: v.id("users"),
    event: v.string(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("actionHistory", {
      ...args,
      timestamp: Date.now(),
    })
  },
})

export const getForUser = query({
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
      .query("actionHistory")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit ?? 50)
  },
})
