import { query, mutation } from "./_generated/server"
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
  },
  handler: async (ctx, { id, status }) => {
    await ctx.db.patch(id, { status })
  },
})
