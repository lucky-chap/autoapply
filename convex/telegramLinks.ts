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

export const internalUnlinkByChatId = internalMutation({
  args: { telegramChatId: v.string() },
  handler: async (ctx, { telegramChatId }) => {
    const link = await ctx.db
      .query("telegramLinks")
      .withIndex("by_telegramChatId", (q) =>
        q.eq("telegramChatId", telegramChatId)
      )
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

// ── Message buffer (for split Telegram messages) ──

export const appendToMessageBuffer = internalMutation({
  args: {
    telegramChatId: v.string(),
    text: v.string(),
  },
  handler: async (ctx, { telegramChatId, text }) => {
    const existing = await ctx.db
      .query("messageBuffer")
      .withIndex("by_telegramChatId", (q) => q.eq("telegramChatId", telegramChatId))
      .first()
    const now = Date.now()
    if (existing) {
      await ctx.db.patch(existing._id, {
        parts: [...existing.parts, text],
        lastMessageAt: now,
      })
      return { isFirst: false }
    }
    await ctx.db.insert("messageBuffer", {
      telegramChatId,
      parts: [text],
      lastMessageAt: now,
    })
    return { isFirst: true }
  },
})

export const consumeMessageBuffer = internalMutation({
  args: { telegramChatId: v.string() },
  handler: async (ctx, { telegramChatId }) => {
    const buf = await ctx.db
      .query("messageBuffer")
      .withIndex("by_telegramChatId", (q) => q.eq("telegramChatId", telegramChatId))
      .first()
    if (!buf) return null
    await ctx.db.delete(buf._id)
    return buf.parts.join("\n")
  },
})

export const getMessageBuffer = internalQuery({
  args: { telegramChatId: v.string() },
  handler: async (ctx, { telegramChatId }) => {
    return await ctx.db
      .query("messageBuffer")
      .withIndex("by_telegramChatId", (q) => q.eq("telegramChatId", telegramChatId))
      .first()
  },
})

// ── Job input mode (user must /job before pasting a job description) ──

export const setJobInputMode = internalMutation({
  args: { telegramChatId: v.string() },
  handler: async (ctx, { telegramChatId }) => {
    const existing = await ctx.db
      .query("jobInputMode")
      .withIndex("by_telegramChatId", (q) => q.eq("telegramChatId", telegramChatId))
      .first()
    if (existing) return // already in job mode
    await ctx.db.insert("jobInputMode", {
      telegramChatId,
      createdAt: Date.now(),
    })
  },
})

export const getJobInputMode = internalQuery({
  args: { telegramChatId: v.string() },
  handler: async (ctx, { telegramChatId }) => {
    return await ctx.db
      .query("jobInputMode")
      .withIndex("by_telegramChatId", (q) => q.eq("telegramChatId", telegramChatId))
      .first()
  },
})

export const clearJobInputMode = internalMutation({
  args: { telegramChatId: v.string() },
  handler: async (ctx, { telegramChatId }) => {
    const doc = await ctx.db
      .query("jobInputMode")
      .withIndex("by_telegramChatId", (q) => q.eq("telegramChatId", telegramChatId))
      .first()
    if (doc) {
      await ctx.db.delete(doc._id)
    }
  },
})

// ── Pending salary review (when salary is below user's minimum) ──

export const savePendingSalaryReview = internalMutation({
  args: {
    telegramChatId: v.string(),
    userId: v.string(),
    jobDescription: v.string(),
    company: v.string(),
    role: v.string(),
    email: v.string(),
    salary: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pendingSalaryReview")
      .withIndex("by_telegramChatId", (q) => q.eq("telegramChatId", args.telegramChatId))
      .first()
    if (existing) {
      await ctx.db.delete(existing._id)
    }
    return await ctx.db.insert("pendingSalaryReview", {
      ...args,
      createdAt: Date.now(),
    })
  },
})

export const getPendingSalaryReview = internalQuery({
  args: { id: v.id("pendingSalaryReview") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id)
  },
})

export const deletePendingSalaryReview = internalMutation({
  args: { id: v.id("pendingSalaryReview") },
  handler: async (ctx, { id }) => {
    const doc = await ctx.db.get(id)
    if (doc) {
      await ctx.db.delete(id)
    }
  },
})

// ── Deep link token-based linking (one-click from web to Telegram) ──

export const createLinkingToken = mutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    // Delete existing tokens for this user
    const existing = await ctx.db
      .query("linkingTokens")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(10)
    for (const doc of existing) {
      await ctx.db.delete(doc._id)
    }

    const token = Array.from(crypto.getRandomValues(new Uint8Array(12)))
      .map((b) => b.toString(36).padStart(2, "0"))
      .join("")
      .slice(0, 16)

    await ctx.db.insert("linkingTokens", {
      userId,
      token,
      expiresAt: Date.now() + 15 * 60 * 1000,
    })
    return token
  },
})

export const consumeLinkingToken = internalMutation({
  args: {
    token: v.string(),
    telegramChatId: v.string(),
  },
  handler: async (ctx, { token, telegramChatId }) => {
    const record = await ctx.db
      .query("linkingTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first()

    if (!record || record.expiresAt < Date.now()) {
      if (record) await ctx.db.delete(record._id)
      return { success: false as const, error: "Invalid or expired token" }
    }

    const userId = record.userId

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
        q.eq("telegramChatId", telegramChatId)
      )
      .first()
    if (existingByChat) {
      await ctx.db.delete(existingByChat._id)
    }

    // Create the link
    await ctx.db.insert("telegramLinks", {
      userId,
      telegramChatId,
      linkedAt: Date.now(),
    })

    // Delete the used token
    await ctx.db.delete(record._id)

    return { success: true as const, userId }
  },
})

// ── Approval tokens (step-up auth for email sending via Telegram) ──

export const createApprovalToken = internalMutation({
  args: { pendingActionId: v.id("pendingActions") },
  handler: async (ctx, { pendingActionId }) => {
    // Delete any existing tokens for this pending action
    const existing = await ctx.db
      .query("approvalTokens")
      .withIndex("by_pendingActionId", (q) =>
        q.eq("pendingActionId", pendingActionId)
      )
      .take(10)
    for (const doc of existing) {
      await ctx.db.delete(doc._id)
    }

    const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => b.toString(36).padStart(2, "0"))
      .join("")
      .slice(0, 32)

    await ctx.db.insert("approvalTokens", {
      pendingActionId,
      token,
      expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
    })
    return token
  },
})

export const consumeApprovalToken = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const record = await ctx.db
      .query("approvalTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first()

    if (!record || record.expiresAt < Date.now()) {
      if (record) await ctx.db.delete(record._id)
      return { success: false as const, error: "Invalid or expired approval link" }
    }

    const pendingActionId = record.pendingActionId
    await ctx.db.delete(record._id)
    return { success: true as const, pendingActionId }
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

    // Clean up expired linking tokens
    const expiredTokens = await ctx.db
      .query("linkingTokens")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .take(100)
    for (const doc of expiredTokens) {
      await ctx.db.delete(doc._id)
    }

    // Clean up expired approval tokens
    const expiredApprovalTokens = await ctx.db
      .query("approvalTokens")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .take(100)
    for (const doc of expiredApprovalTokens) {
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

    // Clean up stale message buffers (older than 5 minutes)
    const bufferCutoff = now - 5 * 60 * 1000
    const staleBuffers = await ctx.db
      .query("messageBuffer")
      .filter((q) => q.lt(q.field("lastMessageAt"), bufferCutoff))
      .take(100)
    for (const doc of staleBuffers) {
      await ctx.db.delete(doc._id)
    }

    // Clean up stale job input mode flags (older than 10 minutes)
    const jobModeCutoff = now - 10 * 60 * 1000
    const staleJobModes = await ctx.db
      .query("jobInputMode")
      .filter((q) => q.lt(q.field("createdAt"), jobModeCutoff))
      .take(100)
    for (const doc of staleJobModes) {
      await ctx.db.delete(doc._id)
    }

    // Clean up stale pending salary reviews (older than 30 minutes)
    const salaryReviewCutoff = now - 30 * 60 * 1000
    const staleSalaryReviews = await ctx.db
      .query("pendingSalaryReview")
      .filter((q) => q.lt(q.field("createdAt"), salaryReviewCutoff))
      .take(100)
    for (const doc of staleSalaryReviews) {
      await ctx.db.delete(doc._id)
    }
  },
})
