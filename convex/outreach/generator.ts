import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

export const generateOutreachEmail = internalAction({
  args: {
    userId: v.string(),
    jobListingId: v.id("jobListings"),
    prospectId: v.id("prospects"),
  },
  handler: async (ctx, { userId, jobListingId, prospectId }) => {
    const job: any = await ctx.runQuery(internal.sourcing.queries.getJobById, { jobId: jobListingId });
    const prospect: any = await ctx.runQuery(internal.sourcing.queries.getProspectById, { prospectId });
    const profile: any = await ctx.runQuery(internal.resumeProfiles.getByUserInternal, { userId });

    if (!job || !prospect || !profile) {
      throw new Error("Missing data to generate email");
    }

    const appBaseUrl = process.env.APP_BASE_URL;
    if (!appBaseUrl) {
      throw new Error("APP_BASE_URL not set");
    }

    const apiSecret = process.env.CONVEX_API_SECRET;

    const apiResponse = await fetch(`${appBaseUrl}/api/outreach/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiSecret}`,
      },
      body: JSON.stringify({
        prospect: {
          name: prospect.name,
          title: prospect.title,
          company: prospect.company,
        },
        job: {
          title: job.title,
          description: job.description,
        },
        profile: {
          skills: profile.skills,
          rawText: profile.rawText,
        },
      }),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error(`Vertex API error (${apiResponse.status}): ${errorText}`);
      throw new Error("Failed to generate outreach email via Vertex AI");
    }

    const result = await apiResponse.json();
    return result as { subject: string; body: string };
  },
});
