import { query } from "../_generated/server";
import { v } from "convex/values";

export const getProspects = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("prospects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
  },
});

export const getOutreachStats = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const prospects = await ctx.db
      .query("prospects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const logs = await ctx.db
      .query("outreachLogs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const sent = logs.filter((l) => l.status === "sent").length;
    const replied = logs.filter((l) => l.status === "replied").length;
    const bounced = logs.filter((l) => l.status === "bounced").length;

    return {
      totalProspects: prospects.length,
      emailsSent: sent,
      repliesReceived: replied,
      bounceRate: sent > 0 ? (bounced / sent) * 100 : 0,
    };
  },
});

export const getOutreachLogs = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const logs = await ctx.db
      .query("outreachLogs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);

    const results = [];
    for (const log of logs) {
      const prospect = await ctx.db.get(log.prospectId);
      const job = await ctx.db.get(log.jobListingId);
      results.push({
        ...log,
        prospectName: prospect?.name || "Unknown",
        company: job?.company || "Unknown",
        role: job?.title || "Unknown",
      });
    }
    return results;
  },
});
