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
    lastCheckedGmailMsgId: v.optional(v.string()),
    followUpSentAt: v.optional(v.number()),
    emailSentAt: v.optional(v.number()),
    openCount: v.optional(v.number()),
    clickCount: v.optional(v.number()),
    schedulingLink: v.optional(v.string()),
    proposedTimes: v.optional(v.array(v.string())),
    source: v.optional(v.union(v.literal("web"), v.literal("telegram"))),
    jobListingId: v.optional(v.id("jobListings")),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_userId_and_jobListingId", ["userId", "jobListingId"]),

  emailOpens: defineTable({
    applicationId: v.id("applications"),
    openedAt: v.number(),
    userAgent: v.optional(v.string()),
  }).index("by_applicationId", ["applicationId"]),

  linkClicks: defineTable({
    applicationId: v.id("applications"),
    url: v.string(),
    clickedAt: v.number(),
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
    githubUrl: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    portfolioUrl: v.optional(v.string()),
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

  linkingTokens: defineTable({
    userId: v.string(),
    token: v.string(),
    expiresAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_userId", ["userId"]),

  userTokens: defineTable({
    userId: v.string(),
    auth0RefreshToken: v.string(),
    cachedAccessToken: v.optional(v.string()),
    accessTokenExpiresAt: v.optional(v.number()),
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
    jobListingId: v.optional(v.id("jobListings")),
    attachResume: v.optional(v.boolean()),
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

  messageBuffer: defineTable({
    telegramChatId: v.string(),
    parts: v.array(v.string()),
    lastMessageAt: v.number(),
  }).index("by_telegramChatId", ["telegramChatId"]),

  jobInputMode: defineTable({
    telegramChatId: v.string(),
    createdAt: v.number(),
  }).index("by_telegramChatId", ["telegramChatId"]),

  pendingSalaryReview: defineTable({
    telegramChatId: v.string(),
    userId: v.string(),
    jobDescription: v.string(),
    company: v.string(),
    role: v.string(),
    email: v.string(),
    salary: v.number(),
    createdAt: v.number(),
  }).index("by_telegramChatId", ["telegramChatId"]),

  userSettings: defineTable({
    userId: v.string(),
    autoMode: v.boolean(),
    autoModeEnabledAt: v.optional(v.number()),
    onboardingCompleted: v.boolean(),
    openclawGatewayUrl: v.optional(v.string()),
    openclawGatewayToken: v.optional(v.string()),
    openclawEnabled: v.optional(v.boolean()),
    availabilitySchedule: v.optional(
      v.array(
        v.object({
          day: v.number(),
          enabled: v.boolean(),
          startHour: v.number(),
          startMinute: v.number(),
          endHour: v.number(),
          endMinute: v.number(),
        })
      )
    ),
  }).index("by_user", ["userId"]),

  pendingCalendarSlots: defineTable({
    applicationId: v.id("applications"),
    telegramChatId: v.string(),
    slots: v.array(
      v.object({
        label: v.string(),
        start: v.string(),
        end: v.string(),
      })
    ),
    proposedTimeStatus: v.array(
      v.object({
        label: v.string(),
        available: v.union(v.boolean(), v.null()),
      })
    ),
    createdAt: v.number(),
  }).index("by_applicationId_and_telegramChatId", [
    "applicationId",
    "telegramChatId",
  ]),

  jobListings: defineTable({
    externalId: v.string(),
    source: v.string(),
    title: v.string(),
    company: v.string(),
    description: v.string(),
    url: v.string(),
    location: v.string(),
    salary: v.optional(v.string()),
    category: v.optional(v.string()),
    postedAt: v.optional(v.number()),
    fetchedAt: v.number(),
    email: v.optional(v.string()),
    hasEmail: v.optional(v.boolean()),
    domain: v.optional(v.string()),
    department: v.optional(v.string()),
  })
    .index("by_source_and_externalId", ["source", "externalId"])
    .index("by_fetchedAt", ["fetchedAt"])
    .index("by_hasEmail_and_fetchedAt", ["hasEmail", "fetchedAt"]),

  prospects: defineTable({
    userId: v.string(),
    jobListingId: v.id("jobListings"),
    name: v.string(),
    email: v.string(),
    title: v.string(),
    company: v.string(),
    seniority: v.optional(v.string()),
    department: v.optional(v.string()),
    source: v.union(v.literal("apollo"), v.literal("pdl"), v.literal("manual"), v.literal("job_post")),
    status: v.union(
      v.literal("new"),
      v.literal("verified"),
      v.literal("invalid"),
      v.literal("contacted")
    ),
    enrichmentData: v.optional(v.any()), // Raw data from enrichment APIs
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_jobListingId", ["jobListingId"])
    .index("by_userId_and_status", ["userId", "status"]),

  outreachLogs: defineTable({
    userId: v.string(),
    prospectId: v.id("prospects"),
    jobListingId: v.id("jobListings"),
    actionType: v.literal("email_sent"),
    status: v.union(v.literal("sent"), v.literal("bounced"), v.literal("replied")),
    sentAt: v.number(),
    payload: v.object({
      subject: v.string(),
      body: v.string(),
    }),
    gmailThreadId: v.optional(v.string()),
    replyAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_prospectId", ["prospectId"])
    .index("by_jobListingId", ["jobListingId"]),

  userJobMatches: defineTable({
    userId: v.string(),
    jobListingId: v.id("jobListings"),
    status: v.union(
      v.literal("new"),
      v.literal("ignored"),
      v.literal("approved"),
      v.literal("applied")
    ),
    matchScore: v.optional(v.number()),
    matchReasoning: v.optional(v.string()),
    telegramNotified: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId_and_status", ["userId", "status"])
    .index("by_userId_and_jobListingId", ["userId", "jobListingId"]),
})
