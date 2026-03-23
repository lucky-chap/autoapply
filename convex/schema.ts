import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  applications: defineTable({
    userId: v.string(),
    company: v.string(),
    role: v.string(),
    status: v.union(
      v.literal("Applied"),
      v.literal("Replied"),
      v.literal("Interview"),
      v.literal("Offer"),
      v.literal("Rejected")
    ),
    coverLetter: v.string(),
    recipientEmail: v.string(),
    gmailThreadId: v.optional(v.string()),
    emailSentAt: v.optional(v.number()),
    openCount: v.optional(v.number()),
    source: v.optional(v.union(v.literal("web"), v.literal("telegram"))),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  emailOpens: defineTable({
    applicationId: v.id("applications"),
    openedAt: v.number(),
    userAgent: v.optional(v.string()),
  }).index("by_applicationId", ["applicationId"]),

  resumeProfiles: defineTable({
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
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  preferences: defineTable({
    userId: v.string(),
    targetRoles: v.array(v.string()),
    targetLocations: v.array(v.string()),
    minSalary: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  telegramLinks: defineTable({
    userId: v.string(),
    telegramChatId: v.string(),
    linkedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_telegramChatId", ["telegramChatId"]),

  linkingCodes: defineTable({
    code: v.string(),
    telegramChatId: v.string(),
    expiresAt: v.number(),
  }).index("by_code", ["code"]),

  userTokens: defineTable({
    userId: v.string(),
    auth0RefreshToken: v.string(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  pendingActions: defineTable({
    userId: v.string(),
    actionType: v.literal("send_email"),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("executed"),
      v.literal("failed")
    ),
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
    resolvedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    applicationId: v.optional(v.id("applications")),
    createdAt: v.number(),
  }).index("by_userId_and_status", ["userId", "status"]),

  telegramUpdates: defineTable({
    updateId: v.number(),
    processedAt: v.number(),
  }).index("by_updateId", ["updateId"]),

  pendingEmailInput: defineTable({
    telegramChatId: v.string(),
    jobDescription: v.string(),
    company: v.string(),
    role: v.string(),
    createdAt: v.number(),
  }).index("by_telegramChatId", ["telegramChatId"]),
})
