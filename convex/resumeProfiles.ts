import { query, mutation } from "./_generated/server"
import { v } from "convex/values"

export const getByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("resumeProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first()
  },
})

export const upsert = mutation({
  args: {
    userId: v.string(),
    skills: v.array(v.string()),
    experience: v.array(
      v.object({
        title: v.string(),
        company: v.string(),
        years: v.number(),
      })
    ),
    tone: v.string(),
    rawText: v.string(),
    fileId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("resumeProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: Date.now() })
    } else {
      await ctx.db.insert("resumeProfiles", { ...args, updatedAt: Date.now() })
    }
  },
})

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl()
  },
})

export const getFileUrl = query({
  args: { fileId: v.id("_storage") },
  handler: async (ctx, { fileId }) => {
    return await ctx.storage.getUrl(fileId)
  },
})
