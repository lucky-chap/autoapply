import { internalMutation, internalQuery } from "../_generated/server"
import { v } from "convex/values"

// ── HubSpot Contacts ──

export const upsertContact = internalMutation({
  args: {
    hubspotId: v.string(),
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    company: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    lifecycleStage: v.optional(v.string()),
    lastActivityDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("hubspotContacts")
      .withIndex("by_hubspotId", (q) => q.eq("hubspotId", args.hubspotId))
      .first()

    const now = Date.now()

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        firstName: args.firstName,
        lastName: args.lastName,
        company: args.company,
        jobTitle: args.jobTitle,
        lifecycleStage: args.lifecycleStage,
        lastActivityDate: args.lastActivityDate,
        syncedAt: now,
      })
      return existing._id
    }

    return await ctx.db.insert("hubspotContacts", {
      ...args,
      syncedAt: now,
      createdAt: now,
    })
  },
})

export const getContactById = internalQuery({
  args: { id: v.id("hubspotContacts") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id)
  },
})

export const getContactByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("hubspotContacts")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first()
  },
})

export const getContactsNeedingOutreach = internalQuery({
  args: { userId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { userId, limit }) => {
    const contacts = await ctx.db
      .query("hubspotContacts")
      .order("desc")
      .take(limit ?? 50)

    // Filter out contacts that already have an active sequence for this user
    const results = []
    for (const contact of contacts) {
      const existingSequence = await ctx.db
        .query("outreachSequences")
        .withIndex("by_contactId", (q) => q.eq("contactId", contact._id))
        .first()

      if (!existingSequence || existingSequence.status === "completed" || existingSequence.status === "bounced") {
        // Only include if no sequence or the previous one finished
        const hasActiveForUser = existingSequence && existingSequence.userId === userId &&
          (existingSequence.status === "active" || existingSequence.status === "paused")
        if (!hasActiveForUser) {
          results.push(contact)
        }
      }
    }

    return results
  },
})

export const getContactCount = internalQuery({
  args: {},
  handler: async (ctx) => {
    const contacts = await ctx.db.query("hubspotContacts").collect()
    return contacts.length
  },
})

// ── Outreach Sequences ──

export const createSequence = internalMutation({
  args: {
    contactId: v.id("hubspotContacts"),
    userId: v.string(),
    stepCount: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    return await ctx.db.insert("outreachSequences", {
      contactId: args.contactId,
      userId: args.userId,
      status: "active",
      stepCount: args.stepCount,
      currentStep: 0,
      nextSendAt: now, // Ready to send immediately
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const updateSequence = internalMutation({
  args: {
    id: v.id("outreachSequences"),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("paused"),
        v.literal("completed"),
        v.literal("bounced")
      )
    ),
    currentStep: v.optional(v.number()),
    nextSendAt: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...updates }) => {
    const filtered: Record<string, unknown> = { updatedAt: Date.now() }
    if (updates.status !== undefined) filtered.status = updates.status
    if (updates.currentStep !== undefined) filtered.currentStep = updates.currentStep
    if (updates.nextSendAt !== undefined) filtered.nextSendAt = updates.nextSendAt
    await ctx.db.patch(id, filtered)
  },
})

export const getSequencesDueForSend = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const now = Date.now()
    const sequences = await ctx.db
      .query("outreachSequences")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", userId).eq("status", "active")
      )
      .collect()

    return sequences.filter(
      (s) => s.nextSendAt !== undefined && s.nextSendAt <= now
    )
  },
})

export const getSequenceByContact = internalQuery({
  args: {
    contactId: v.id("hubspotContacts"),
    userId: v.string(),
  },
  handler: async (ctx, { contactId, userId }) => {
    const sequences = await ctx.db
      .query("outreachSequences")
      .withIndex("by_contactId", (q) => q.eq("contactId", contactId))
      .collect()
    return sequences.find((s) => s.userId === userId) ?? null
  },
})

// ── Outreach Messages ──

export const createMessage = internalMutation({
  args: {
    sequenceId: v.id("outreachSequences"),
    contactId: v.id("hubspotContacts"),
    userId: v.string(),
    step: v.number(),
    subject: v.string(),
    body: v.string(),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("pending_approval"),
        v.literal("sent"),
        v.literal("opened"),
        v.literal("replied"),
        v.literal("failed")
      )
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("outreachMessages", {
      sequenceId: args.sequenceId,
      contactId: args.contactId,
      userId: args.userId,
      step: args.step,
      subject: args.subject,
      body: args.body,
      status: args.status ?? "draft",
      createdAt: Date.now(),
    })
  },
})

export const updateMessageStatus = internalMutation({
  args: {
    id: v.id("outreachMessages"),
    status: v.union(
      v.literal("draft"),
      v.literal("pending_approval"),
      v.literal("sent"),
      v.literal("opened"),
      v.literal("replied"),
      v.literal("failed")
    ),
    pendingActionId: v.optional(v.id("pendingActions")),
    gmailMessageId: v.optional(v.string()),
    gmailThreadId: v.optional(v.string()),
    sentAt: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...updates }) => {
    const filtered: Record<string, unknown> = { status: updates.status }
    if (updates.pendingActionId !== undefined) filtered.pendingActionId = updates.pendingActionId
    if (updates.gmailMessageId !== undefined) filtered.gmailMessageId = updates.gmailMessageId
    if (updates.gmailThreadId !== undefined) filtered.gmailThreadId = updates.gmailThreadId
    if (updates.sentAt !== undefined) filtered.sentAt = updates.sentAt
    await ctx.db.patch(id, filtered)
  },
})

export const recordMessageOpen = internalMutation({
  args: { id: v.id("outreachMessages") },
  handler: async (ctx, { id }) => {
    const msg = await ctx.db.get(id)
    if (!msg) return
    await ctx.db.patch(id, {
      status: "opened",
      openCount: (msg.openCount ?? 0) + 1,
      openedAt: msg.openedAt ?? Date.now(),
    })
  },
})

export const recordMessageReply = internalMutation({
  args: { id: v.id("outreachMessages") },
  handler: async (ctx, { id }) => {
    const msg = await ctx.db.get(id)
    if (!msg) return
    await ctx.db.patch(id, {
      status: "replied",
      repliedAt: Date.now(),
    })
    // Also mark the sequence as completed
    await ctx.db.patch(msg.sequenceId, {
      status: "completed",
      updatedAt: Date.now(),
    })
  },
})

export const getMessageById = internalQuery({
  args: { id: v.id("outreachMessages") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id)
  },
})

export const getMessagesBySequence = internalQuery({
  args: { sequenceId: v.id("outreachSequences") },
  handler: async (ctx, { sequenceId }) => {
    return await ctx.db
      .query("outreachMessages")
      .withIndex("by_sequenceId", (q) => q.eq("sequenceId", sequenceId))
      .collect()
  },
})

export const getSentMessages = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("outreachMessages")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", userId).eq("status", "sent")
      )
      .collect()
  },
})

export const getOpenedMessages = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("outreachMessages")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", userId).eq("status", "opened")
      )
      .collect()
  },
})

// ── Stats ──

export const getOutreachStats = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const contacts = await ctx.db.query("hubspotContacts").collect()
    const contactCount = contacts.length

    const sequences = await ctx.db
      .query("outreachSequences")
      .withIndex("by_userId_and_status", (q) => q.eq("userId", userId))
      .collect()

    const activeCount = sequences.filter((s) => s.status === "active").length
    const completedCount = sequences.filter((s) => s.status === "completed").length

    // Get message counts by status
    const sentMessages = await ctx.db
      .query("outreachMessages")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", userId).eq("status", "sent")
      )
      .collect()

    const openedMessages = await ctx.db
      .query("outreachMessages")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", userId).eq("status", "opened")
      )
      .collect()

    const repliedMessages = await ctx.db
      .query("outreachMessages")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", userId).eq("status", "replied")
      )
      .collect()

    const failedMessages = await ctx.db
      .query("outreachMessages")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", userId).eq("status", "failed")
      )
      .collect()

    return {
      contactCount,
      activeSequences: activeCount,
      completedSequences: completedCount,
      sent: sentMessages.length,
      opened: openedMessages.length,
      replied: repliedMessages.length,
      failed: failedMessages.length,
    }
  },
})
