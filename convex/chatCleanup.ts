import { internalMutation } from "./_generated/server"
import { v } from "convex/values"

export const clearChatState = internalMutation({
  args: {
    telegramChatId: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, { telegramChatId, userId }) => {
    // Clear message buffer
    const buffers = await ctx.db
      .query("messageBuffer")
      .withIndex("by_telegramChatId", (q) =>
        q.eq("telegramChatId", telegramChatId)
      )
      .take(50)
    for (const doc of buffers) {
      await ctx.db.delete(doc._id)
    }

    // Clear pending email input
    const emailInputs = await ctx.db
      .query("pendingEmailInput")
      .withIndex("by_telegramChatId", (q) =>
        q.eq("telegramChatId", telegramChatId)
      )
      .take(50)
    for (const doc of emailInputs) {
      await ctx.db.delete(doc._id)
    }

    // Clear job input mode
    const jobModes = await ctx.db
      .query("jobInputMode")
      .withIndex("by_telegramChatId", (q) =>
        q.eq("telegramChatId", telegramChatId)
      )
      .take(50)
    for (const doc of jobModes) {
      await ctx.db.delete(doc._id)
    }

    // Clear pending salary reviews
    const salaryReviews = await ctx.db
      .query("pendingSalaryReview")
      .withIndex("by_telegramChatId", (q) =>
        q.eq("telegramChatId", telegramChatId)
      )
      .take(50)
    for (const doc of salaryReviews) {
      await ctx.db.delete(doc._id)
    }

    // Clear pending actions for this user (if linked)
    if (userId) {
      const pendingActions = await ctx.db
        .query("pendingActions")
        .withIndex("by_userId_and_status", (q) =>
          q.eq("userId", userId).eq("status", "pending")
        )
        .take(50)
      for (const doc of pendingActions) {
        await ctx.db.patch(doc._id, {
          status: "rejected" as const,
          resolvedAt: Date.now(),
          error: "Cleared by /clear command",
        })
      }
    }
  },
})

export const cleanupStaleChatState = internalMutation({
  args: {},
  handler: async (ctx) => {
    const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000

    // Clean stale message buffers
    const staleBuffers = await ctx.db
      .query("messageBuffer")
      .filter((q) => q.lt(q.field("lastMessageAt"), sixHoursAgo))
      .take(100)
    for (const doc of staleBuffers) {
      await ctx.db.delete(doc._id)
    }

    // Clean stale pending email inputs
    const staleEmailInputs = await ctx.db
      .query("pendingEmailInput")
      .filter((q) => q.lt(q.field("createdAt"), sixHoursAgo))
      .take(100)
    for (const doc of staleEmailInputs) {
      await ctx.db.delete(doc._id)
    }

    // Clean stale job input modes
    const staleJobModes = await ctx.db
      .query("jobInputMode")
      .filter((q) => q.lt(q.field("createdAt"), sixHoursAgo))
      .take(100)
    for (const doc of staleJobModes) {
      await ctx.db.delete(doc._id)
    }

    // Clean stale salary reviews
    const staleSalaryReviews = await ctx.db
      .query("pendingSalaryReview")
      .filter((q) => q.lt(q.field("createdAt"), sixHoursAgo))
      .take(100)
    for (const doc of staleSalaryReviews) {
      await ctx.db.delete(doc._id)
    }
  },
})
