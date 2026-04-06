import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { callVertex } from "../../lib/vertex";

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

    const isGenericProspect = prospect.name === "Hiring Contact";
    const prompt = `
You are an expert at cold outreach for jobs.
Write a short, professional, and highly personalized email to a hiring decision-maker.

PROSPECT:
Name: ${isGenericProspect ? "Unknown (use 'Hi there' or 'Hello' instead of a name)" : prospect.name}
Role: ${prospect.title}
Company: ${prospect.company}

JOB OPENING:
Title: ${job.title}
Description snippet: ${job.description.slice(0, 500)}...

MY PROFILE:
Skills: ${profile.skills.join(", ")}
Experience Summary: ${profile.rawText.slice(0, 1000)}

GUIDELINES:
1. Keep it under 100 words.
2. Focus on how I can help their team based on the job description.
3. No generic fluff. Mention a specific skill or project that fits.
4. Casual but professional tone.
5. Signature should just be my name (from profile).
6. Return JSON with 'subject' and 'body' fields.

Return EXACTLY a JSON object, NO markdown formatting:
{
  "subject": "Quick question regarding [Job Title] role at [Company]",
  "body": "Hi [Name], ..."
}
`;

    const result = await callVertex(prompt, 2000);

    const cleanJson = result
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();

    const parsed = JSON.parse(cleanJson);
    return parsed as { subject: string; body: string };
  },
});
