import {
  query,
  mutation,
  internalMutation,
  internalQuery,
} from "./_generated/server"
import { internal } from "./_generated/api"
import { v } from "convex/values"

export const create = internalMutation({
  args: {
    userId: v.string(),
    actionType: v.literal("send_email"),
    payload: v.object({
      to: v.string(),
      subject: v.string(),
      body: v.string(),
      company: v.string(),
      role: v.string(),
      coverLetter: v.string(),
    }),
    telegramMessageId: v.optional(v.string()),
    telegramChatId: v.optional(v.string()),
    source: v.union(v.literal("telegram"), v.literal("web")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("pendingActions", {
      ...args,
      status: "pending",
      createdAt: Date.now(),
    })
  },
})

export const approve = mutation({
  args: { id: v.id("pendingActions") },
  handler: async (ctx, { id }) => {
    const action = await ctx.db.get(id)
    if (!action) throw new Error("Action not found")
    if (action.status !== "pending") throw new Error("Action is no longer pending")

    await ctx.db.patch(id, { status: "approved", resolvedAt: Date.now() })

    // Schedule the execution immediately
    await ctx.scheduler.runAfter(0, internal.telegram.executeApprovedAction, {
      pendingActionId: id,
    })
  },
})

export const reject = mutation({
  args: { id: v.id("pendingActions") },
  handler: async (ctx, { id }) => {
    const action = await ctx.db.get(id)
    if (!action) throw new Error("Action not found")
    if (action.status !== "pending") throw new Error("Action is no longer pending")

    await ctx.db.patch(id, { status: "rejected", resolvedAt: Date.now() })

    // Notify via Telegram if it came from there
    if (action.telegramChatId) {
      await ctx.scheduler.runAfter(0, internal.telegram.sendNotification, {
        chatId: action.telegramChatId,
        text: `❌ Application to ${action.payload.company} for ${action.payload.role} was rejected. The email was not sent.`,
      })
    }
  },
})

export const getByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("pendingActions")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", userId).eq("status", "pending")
      )
      .order("desc")
      .take(50)
  },
})

export const updateStatus = internalMutation({
  args: {
    id: v.id("pendingActions"),
    status: v.union(
      v.literal("executed"),
      v.literal("failed")
    ),
    error: v.optional(v.string()),
    applicationId: v.optional(v.id("applications")),
  },
  handler: async (ctx, { id, status, error, applicationId }) => {
    await ctx.db.patch(id, {
      status,
      resolvedAt: Date.now(),
      ...(error ? { error } : {}),
      ...(applicationId ? { applicationId } : {}),
    })
  },
})

export const getById = internalQuery({
  args: { id: v.id("pendingActions") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id)
  },
})

export const internalApprove = internalMutation({
  args: { id: v.id("pendingActions") },
  handler: async (ctx, { id }) => {
    const action = await ctx.db.get(id)
    if (!action) throw new Error("Action not found")
    if (action.status !== "pending") throw new Error("Action is no longer pending")

    await ctx.db.patch(id, { status: "approved", resolvedAt: Date.now() })

    await ctx.scheduler.runAfter(0, internal.telegram.executeApprovedAction, {
      pendingActionId: id,
    })
  },
})

export const internalReject = internalMutation({
  args: { id: v.id("pendingActions") },
  handler: async (ctx, { id }) => {
    const action = await ctx.db.get(id)
    if (!action) throw new Error("Action not found")
    if (action.status !== "pending") throw new Error("Action is no longer pending")

    await ctx.db.patch(id, { status: "rejected", resolvedAt: Date.now() })

    if (action.telegramChatId) {
      await ctx.scheduler.runAfter(0, internal.telegram.sendNotification, {
        chatId: action.telegramChatId,
        text: `❌ Application to ${action.payload.company} for ${action.payload.role} was rejected. The email was not sent.`,
      })
    }
  },
})

export const retryFailed = internalMutation({
  args: { id: v.id("pendingActions") },
  handler: async (ctx, { id }) => {
    const action = await ctx.db.get(id)
    if (!action) throw new Error("Action not found")
    if (action.status !== "failed") throw new Error("Action is not in failed state")

    await ctx.db.patch(id, {
      status: "approved",
      resolvedAt: Date.now(),
      error: undefined,
    })

    await ctx.scheduler.runAfter(0, internal.telegram.executeApprovedAction, {
      pendingActionId: id,
    })
  },
})

export const setTelegramMessageId = internalMutation({
  args: {
    pendingActionId: v.id("pendingActions"),
    telegramMessageId: v.string(),
  },
  handler: async (ctx, { pendingActionId, telegramMessageId }) => {
    await ctx.db.patch(pendingActionId, { telegramMessageId })
  },
})

export const cleanupStale = internalMutation({
  args: {},
  handler: async (ctx) => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
    // Clean up pending actions older than 24 hours
    const stale = await ctx.db
      .query("pendingActions")
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "pending"),
          q.lt(q.field("createdAt"), oneDayAgo)
        )
      )
      .take(100)
    for (const doc of stale) {
      await ctx.db.patch(doc._id, {
        status: "rejected" as const,
        resolvedAt: Date.now(),
        error: "Expired — no response within 24 hours",
      })
    }
  },
})
