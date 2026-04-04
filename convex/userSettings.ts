import {
  query,
  mutation,
  internalQuery,
} from "./_generated/server"
import { v } from "convex/values"

const availabilityScheduleValidator = v.array(
  v.object({
    day: v.number(),
    enabled: v.boolean(),
    startHour: v.number(),
    startMinute: v.number(),
    endHour: v.number(),
    endMinute: v.number(),
  })
)

export const getByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first()
  },
})

export const getByUserInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first()
  },
})

export const updateAvailability = mutation({
  args: {
    userId: v.string(),
    availabilitySchedule: availabilityScheduleValidator,
  },
  handler: async (ctx, { userId, availabilitySchedule }) => {
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, { availabilitySchedule })
    } else {
      await ctx.db.insert("userSettings", {
        userId,
        onboardingCompleted: false,
        availabilitySchedule,
      })
    }
  },
})

export const updateOpenclawSettings = mutation({
  args: {
    userId: v.string(),
    openclawGatewayUrl: v.optional(v.string()),
    openclawGatewayToken: v.optional(v.string()),
    openclawEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, { userId, ...settings }) => {
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, settings)
    } else {
      await ctx.db.insert("userSettings", {
        userId,
        onboardingCompleted: false,
        ...settings,
      })
    }
  },
})

export const completeOnboarding = mutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, { onboardingCompleted: true })
    } else {
      await ctx.db.insert("userSettings", {
        userId,
        onboardingCompleted: true,
      })
    }
  },
})
