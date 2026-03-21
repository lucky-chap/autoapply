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
    emailSentAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

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
})
