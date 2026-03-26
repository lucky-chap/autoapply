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

export const getCachedToken = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const doc = await ctx.db
      .query("userTokens")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()
    if (!doc) return null
    return {
      auth0RefreshToken: doc.auth0RefreshToken,
      cachedAccessToken: doc.cachedAccessToken ?? null,
      accessTokenExpiresAt: doc.accessTokenExpiresAt ?? null,
    }
  },
})

export const updateCachedAccessToken = internalMutation({
  args: {
    userId: v.string(),
    cachedAccessToken: v.string(),
    accessTokenExpiresAt: v.number(),
  },
  handler: async (ctx, { userId, cachedAccessToken, accessTokenExpiresAt }) => {
    const existing = await ctx.db
      .query("userTokens")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()
    if (existing) {
      await ctx.db.patch(existing._id, {
        cachedAccessToken,
        accessTokenExpiresAt,
        updatedAt: Date.now(),
      })
    }
  },
})
