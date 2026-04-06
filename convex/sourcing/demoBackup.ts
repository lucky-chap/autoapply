import { internalMutation } from "../_generated/server"
import { v } from "convex/values"

/**
 * Back up all "new" matches for a user into the demoBackupMatches table.
 */
export const backupMatches = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const matches = await ctx.db
      .query("userJobMatches")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", userId).eq("status", "new")
      )
      .collect()

    // Clear any existing backup for this user first
    const existing = await ctx.db
      .query("demoBackupMatches")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect()
    for (const e of existing) {
      await ctx.db.delete(e._id)
    }

    const now = Date.now()
    for (const m of matches) {
      await ctx.db.insert("demoBackupMatches", {
        originalMatchId: m._id,
        userId: m.userId,
        jobListingId: m.jobListingId,
        status: m.status,
        matchScore: m.matchScore,
        matchReasoning: m.matchReasoning,
        telegramNotified: m.telegramNotified,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        backedUpAt: now,
      })
    }

    console.log(`Backed up ${matches.length} matches for ${userId}`)
    return matches.length
  },
})

/**
 * Restore backed-up matches for a user.
 * Re-inserts them as "new" + unnotified so they show up fresh on Telegram.
 */
export const restoreMatches = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const backups = await ctx.db
      .query("demoBackupMatches")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect()

    if (backups.length === 0) {
      console.log(`No backup found for ${userId}`)
      return 0
    }

    const now = Date.now()
    let restored = 0

    for (const b of backups) {
      // Check if this match already exists (avoid duplicates)
      const existing = await ctx.db
        .query("userJobMatches")
        .withIndex("by_userId_and_jobListingId", (q) =>
          q.eq("userId", b.userId).eq("jobListingId", b.jobListingId)
        )
        .first()

      if (existing) {
        // Reset it back to "new" and unnotified
        await ctx.db.patch(existing._id, {
          status: "new",
          matchScore: b.matchScore,
          matchReasoning: b.matchReasoning,
          telegramNotified: false,
          updatedAt: now,
        })
      } else {
        // Re-insert
        await ctx.db.insert("userJobMatches", {
          userId: b.userId,
          jobListingId: b.jobListingId,
          status: "new",
          matchScore: b.matchScore,
          matchReasoning: b.matchReasoning,
          telegramNotified: false,
          createdAt: b.createdAt,
          updatedAt: now,
        })
      }
      restored++
    }

    console.log(`Restored ${restored} matches for ${userId}`)
    return restored
  },
})
