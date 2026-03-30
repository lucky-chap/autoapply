import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    settings: v.optional(
      v.object({
        defaultStandupTime: v.optional(v.string()),
        timezone: v.optional(v.string()),
        autoGenerateStandup: v.optional(v.boolean()),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_tokenIdentifier", ["tokenIdentifier"]),

  standupSessions: defineTable({
    userId: v.id("users"),
    date: v.string(),
    githubActivity: v.optional(v.string()),
    generatedContent: v.optional(v.string()),
    status: v.union(
      v.literal("gathering"),
      v.literal("drafting"),
      v.literal("ready"),
      v.literal("distributed")
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId_and_date", ["userId", "date"]),

  agentActions: defineTable({
    sessionId: v.id("standupSessions"),
    userId: v.id("users"),
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
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("skipped"),
      v.literal("executing"),
      v.literal("executed"),
      v.literal("undone"),
      v.literal("failed")
    ),
    confidence: v.optional(v.number()),
    reasoning: v.optional(v.string()),
    scope: v.optional(v.string()),
    isHighStakes: v.boolean(),
    stepUpCompleted: v.optional(v.boolean()),
    approvedAt: v.optional(v.number()),
    executedAt: v.optional(v.number()),
    undoneAt: v.optional(v.number()),
    undoDeadline: v.optional(v.number()),
    error: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_userId_and_status", ["userId", "status"])
    .index("by_sessionId", ["sessionId"]),

  actionHistory: defineTable({
    actionId: v.id("agentActions"),
    userId: v.id("users"),
    event: v.string(),
    details: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_actionId", ["actionId"]),
})
