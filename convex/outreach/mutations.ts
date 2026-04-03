import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const insertProspect = internalMutation({
  args: {
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
    enrichmentData: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("prospects", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateProspectStatus = internalMutation({
  args: {
    prospectId: v.id("prospects"),
    status: v.union(
      v.literal("new"),
      v.literal("verified"),
      v.literal("invalid"),
      v.literal("contacted")
    ),
  },
  handler: async (ctx, { prospectId, status }) => {
    await ctx.db.patch(prospectId, { status, updatedAt: Date.now() });
  },
});

export const logOutreach = internalMutation({
  args: {
    userId: v.string(),
    prospectId: v.id("prospects"),
    jobListingId: v.id("jobListings"),
    actionType: v.literal("email_sent"),
    status: v.union(v.literal("sent"), v.literal("bounced"), v.literal("replied")),
    payload: v.object({
      subject: v.string(),
      body: v.string(),
    }),
    gmailThreadId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("outreachLogs", {
      ...args,
      sentAt: Date.now(),
    });
  },
});
