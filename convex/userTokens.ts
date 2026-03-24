import { internalMutation, internalQuery } from "./_generated/server"
import { v } from "convex/values"

export const upsertRefreshToken = internalMutation({
  args: {
    userId: v.string(),
    auth0RefreshToken: v.string(),
  },
  handler: async (ctx, { userId, auth0RefreshToken }) => {
    const existing = await ctx.db
      .query("userTokens")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        auth0RefreshToken,
        updatedAt: Date.now(),
      })
    } else {
      await ctx.db.insert("userTokens", {
        userId,
        auth0RefreshToken,
        updatedAt: Date.now(),
      })
    }
  },
})

export const getRefreshToken = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const doc = await ctx.db
      .query("userTokens")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()
    return doc?.auth0RefreshToken ?? null
  },
})
