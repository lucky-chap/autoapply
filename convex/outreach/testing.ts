import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";

/**
 * Manually trigger the end-to-end outreach flow for a specific job and user.
 * This is useful for testing without waiting for the cron job.
 */
export const testOutreachFlow = action({
  args: {
    userId: v.string(),
    jobListingId: v.id("jobListings"),
    overrideDomain: v.optional(v.string()),
    overrideRoles: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { userId, jobListingId, overrideDomain, overrideRoles }): Promise<{ success: boolean; matchId: Id<"userJobMatches"> }> => {
    console.log(`Manually triggering outreach test for user ${userId} and job ${jobListingId}`);

    // 1. Ensure the match exists or create a high-score match manually
    const matchId = await ctx.runMutation(internal.sourcing.store.createMatch, {
      userId,
      jobListingId,
      matchScore: 95, // High score to trigger outreach
      matchReasoning: "Manual test match",
      status: "new",
    });

    // 2. Trigger the orchestrator directly
    await ctx.runAction(internal.outreach.orchestrator.runPipelineForMatch, {
      userId,
      jobListingId,
      matchId,
      overrideDomain,
      overrideRoles,
    });

    return { success: true, matchId };
  },
});
