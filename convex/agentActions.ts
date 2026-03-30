import {
  query,
  mutation,
  internalMutation,
} from "./_generated/server"
import { v } from "convex/values"

export const create = mutation({
  args: {
    sessionId: v.id("standupSessions"),
    agentName: v.union(
      v.literal("github"),
      v.literal("writer"),
      v.literal("slack"),
      v.literal("gmail")
    ),
    platform: v.string(),
    actionType: v.string(),
    content: v.string(),
    metadata: v.optional(v.string()),
    confidence: v.optional(v.number()),
    reasoning: v.optional(v.string()),
    scope: v.optional(v.string()),
    isHighStakes: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const user = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique()

    if (!user) throw new Error("User not found")

    const actionId = await ctx.db.insert("agentActions", {
      ...args,
      userId: user._id,
      status: "pending",
      createdAt: Date.now(),
    })

    // Record in audit trail
    await ctx.db.insert("actionHistory", {
      actionId,
      userId: user._id,
      event: "created",
      details: `${args.agentName} proposed: ${args.actionType} on ${args.platform}`,
      timestamp: Date.now(),
    })

    return actionId
  },
})

export const listPending = query({
  args: {},
  handler: async (ctx) => {
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
      .query("agentActions")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", user._id).eq("status", "pending")
      )
      .order("desc")
      .take(50)
  },
})

export const getBySession = query({
  args: { sessionId: v.id("standupSessions") },
  handler: async (ctx, { sessionId }) => {
    return await ctx.db
      .query("agentActions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .order("desc")
      .take(50)
  },
})

export const approve = mutation({
  args: { id: v.id("agentActions") },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const action = await ctx.db.get(id)
    if (!action) throw new Error("Action not found")
    if (action.status !== "pending")
      throw new Error("Action is no longer pending")

    await ctx.db.patch(id, {
      status: "approved",
      approvedAt: Date.now(),
    })

    await ctx.db.insert("actionHistory", {
      actionId: id,
      userId: action.userId,
      event: "approved",
      timestamp: Date.now(),
    })
  },
})

export const skip = mutation({
  args: { id: v.id("agentActions") },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const action = await ctx.db.get(id)
    if (!action) throw new Error("Action not found")
    if (action.status !== "pending")
      throw new Error("Action is no longer pending")

    await ctx.db.patch(id, { status: "skipped" })

    await ctx.db.insert("actionHistory", {
      actionId: id,
      userId: action.userId,
      event: "skipped",
      timestamp: Date.now(),
    })
  },
})

export const markExecuted = internalMutation({
  args: {
    id: v.id("agentActions"),
    undoDeadline: v.optional(v.number()),
  },
  handler: async (ctx, { id, undoDeadline }) => {
    const action = await ctx.db.get(id)
    if (!action) throw new Error("Action not found")

    await ctx.db.patch(id, {
      status: "executed",
      executedAt: Date.now(),
      undoDeadline: undoDeadline ?? Date.now() + 30_000,
    })

    await ctx.db.insert("actionHistory", {
      actionId: id,
      userId: action.userId,
      event: "executed",
      timestamp: Date.now(),
    })
  },
})

export const markFailed = internalMutation({
  args: {
    id: v.id("agentActions"),
    error: v.string(),
  },
  handler: async (ctx, { id, error }) => {
    const action = await ctx.db.get(id)
    if (!action) throw new Error("Action not found")

    await ctx.db.patch(id, {
      status: "failed",
      error,
    })

    await ctx.db.insert("actionHistory", {
      actionId: id,
      userId: action.userId,
      event: "failed",
      details: error,
      timestamp: Date.now(),
    })
  },
})

export const undo = mutation({
  args: { id: v.id("agentActions") },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const action = await ctx.db.get(id)
    if (!action) throw new Error("Action not found")
    if (action.status !== "executed")
      throw new Error("Can only undo executed actions")
    if (action.undoDeadline && Date.now() > action.undoDeadline)
      throw new Error("Undo window has expired")

    await ctx.db.patch(id, {
      status: "undone",
      undoneAt: Date.now(),
    })

    await ctx.db.insert("actionHistory", {
      actionId: id,
      userId: action.userId,
      event: "undone",
      timestamp: Date.now(),
    })
  },
})
