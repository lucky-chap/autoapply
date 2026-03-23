import {
  query,
  mutation,
  internalMutation,
  internalQuery,
} from "./_generated/server"
import { v } from "convex/values"

export const createLinkingCode = internalMutation({
  args: {
    code: v.string(),
    telegramChatId: v.string(),
  },
  handler: async (ctx, { code, telegramChatId }) => {
    // Delete any existing codes for this chat
    const existing = await ctx.db
      .query("linkingCodes")
      .filter((q) => q.eq(q.field("telegramChatId"), telegramChatId))
      .take(10)
    for (const doc of existing) {
      await ctx.db.delete(doc._id)
    }

    await ctx.db.insert("linkingCodes", {
      code,
      telegramChatId,
      expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
    })
  },
})

export const consumeLinkingCode = mutation({
  args: {
    code: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, { code, userId }) => {
    const linkingCode = await ctx.db
      .query("linkingCodes")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first()

    if (!linkingCode) {
      throw new Error("Invalid or expired linking code.")
    }

    if (linkingCode.expiresAt < Date.now()) {
      await ctx.db.delete(linkingCode._id)
      throw new Error("Linking code has expired. Please request a new one.")
    }

    // Remove any existing link for this user or this chat
    const existingByUser = await ctx.db
      .query("telegramLinks")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()
    if (existingByUser) {
      await ctx.db.delete(existingByUser._id)
    }

    const existingByChat = await ctx.db
      .query("telegramLinks")
      .withIndex("by_telegramChatId", (q) =>
        q.eq("telegramChatId", linkingCode.telegramChatId)
      )
      .first()
    if (existingByChat) {
      await ctx.db.delete(existingByChat._id)
    }

    // Create the link
    await ctx.db.insert("telegramLinks", {
      userId,
      telegramChatId: linkingCode.telegramChatId,
      linkedAt: Date.now(),
    })

    // Delete the used code
    await ctx.db.delete(linkingCode._id)
  },
})

export const getLinkByTelegramChatId = internalQuery({
  args: { telegramChatId: v.string() },
  handler: async (ctx, { telegramChatId }) => {
    return await ctx.db
      .query("telegramLinks")
      .withIndex("by_telegramChatId", (q) =>
        q.eq("telegramChatId", telegramChatId)
      )
      .first()
  },
})

export const getLinkByUserIdInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("telegramLinks")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()
  },
})

export const getLinkByUserId = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("telegramLinks")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()
  },
})

export const unlink = mutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const link = await ctx.db
      .query("telegramLinks")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first()
    if (link) {
      await ctx.db.delete(link._id)
    }
  },
})

// Returns true if this update was already processed (duplicate)
export const checkAndMarkUpdate = internalMutation({
  args: { updateId: v.number() },
  handler: async (ctx, { updateId }) => {
    const existing = await ctx.db
      .query("telegramUpdates")
      .withIndex("by_updateId", (q) => q.eq("updateId", updateId))
      .first()
    if (existing) return true // duplicate
    await ctx.db.insert("telegramUpdates", {
      updateId,
      processedAt: Date.now(),
    })
    return false
  },
})

// ── Pending email input (when job posting has no contact email) ──

export const savePendingEmailInput = internalMutation({
  args: {
    telegramChatId: v.string(),
    jobDescription: v.string(),
    company: v.string(),
    role: v.string(),
  },
  handler: async (ctx, { telegramChatId, jobDescription, company, role }) => {
    // Replace any existing pending input for this chat
    const existing = await ctx.db
      .query("pendingEmailInput")
      .withIndex("by_telegramChatId", (q) => q.eq("telegramChatId", telegramChatId))
      .first()
    if (existing) {
      await ctx.db.delete(existing._id)
    }
    await ctx.db.insert("pendingEmailInput", {
      telegramChatId,
      jobDescription,
      company,
      role,
      createdAt: Date.now(),
    })
  },
})

export const getPendingEmailInput = internalQuery({
  args: { telegramChatId: v.string() },
  handler: async (ctx, { telegramChatId }) => {
    return await ctx.db
      .query("pendingEmailInput")
      .withIndex("by_telegramChatId", (q) => q.eq("telegramChatId", telegramChatId))
      .first()
  },
})

export const deletePendingEmailInput = internalMutation({
  args: { telegramChatId: v.string() },
  handler: async (ctx, { telegramChatId }) => {
    const doc = await ctx.db
      .query("pendingEmailInput")
      .withIndex("by_telegramChatId", (q) => q.eq("telegramChatId", telegramChatId))
      .first()
    if (doc) {
      await ctx.db.delete(doc._id)
    }
  },
})

export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const expired = await ctx.db
      .query("linkingCodes")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .take(100)
    for (const doc of expired) {
      await ctx.db.delete(doc._id)
    }

    // Clean up old telegram update dedup records (older than 1 hour)
    const cutoff = now - 60 * 60 * 1000
    const oldUpdates = await ctx.db
      .query("telegramUpdates")
      .filter((q) => q.lt(q.field("processedAt"), cutoff))
      .take(100)
    for (const doc of oldUpdates) {
      await ctx.db.delete(doc._id)
    }

    // Clean up stale pending email inputs (older than 30 minutes)
    const emailCutoff = now - 30 * 60 * 1000
    const stalePending = await ctx.db
      .query("pendingEmailInput")
      .filter((q) => q.lt(q.field("createdAt"), emailCutoff))
      .take(100)
    for (const doc of stalePending) {
      await ctx.db.delete(doc._id)
    }
  },
})
