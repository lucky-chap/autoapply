import { query, mutation } from "./_generated/server"
import { v } from "convex/values"

export const getOrCreate = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const existing = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique()

    if (existing) {
      // Update profile info if changed
      if (
        existing.name !== identity.name ||
        existing.email !== identity.email ||
        existing.avatarUrl !== identity.pictureUrl
      ) {
        await ctx.db.patch(existing._id, {
          name: identity.name ?? existing.name,
          email: identity.email ?? existing.email,
          avatarUrl: identity.pictureUrl ?? existing.avatarUrl,
          updatedAt: Date.now(),
        })
      }
      return existing._id
    }

    return await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      name: identity.name ?? undefined,
      email: identity.email ?? undefined,
      avatarUrl: identity.pictureUrl ?? undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
})

export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    return await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique()
  },
})

export const updateSettings = mutation({
  args: {
    settings: v.object({
      defaultStandupTime: v.optional(v.string()),
      timezone: v.optional(v.string()),
      autoGenerateStandup: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, { settings }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique()

    if (!user) throw new Error("User not found")

    await ctx.db.patch(user._id, {
      settings,
      updatedAt: Date.now(),
    })
  },
})
