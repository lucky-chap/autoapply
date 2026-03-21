import { query, mutation } from "./_generated/server"
import { v } from "convex/values"

export const getByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("preferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first()
  },
})

export const upsert = mutation({
  args: {
    userId: v.string(),
    targetRoles: v.array(v.string()),
    targetLocations: v.array(v.string()),
    minSalary: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("preferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: Date.now() })
    } else {
      await ctx.db.insert("preferences", { ...args, updatedAt: Date.now() })
    }
  },
})
