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
})
