import { internalAction, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { inferDecisionMakerRoles } from "../../lib/outreach/roleMapper";
import { extractDomain } from "../../lib/outreach/domainUtils";

export const runPipelineForMatch = internalAction({
  args: {
    userId: v.string(),
    jobListingId: v.id("jobListings"),
    matchId: v.id("userJobMatches"),
    overrideDomain: v.optional(v.string()),
    overrideRoles: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { userId, jobListingId, matchId, overrideDomain, overrideRoles }) => {
    const job = await ctx.runQuery(internal.sourcing.queries.getJobById, { jobId: jobListingId });
    if (!job) return;

    // Guard: prevent duplicate applications for the same job
    const alreadyApplied: boolean = await ctx.runQuery(
      internal.applications.hasApplicationForJob,
      { userId, jobListingId }
    );
    if (alreadyApplied) {
      console.log(`Skipping ${job.company} - ${job.title}: already applied`);
      return;
    }

    console.log(`Starting outreach pipeline for ${job.company} - ${job.title}`);

    // Fast path: use email from the job post directly (common in HN "Who's Hiring")
    if (job.email) {
      console.log(`Using job post email directly: ${job.email}`);

      const prospectId = await ctx.runMutation(internal.outreach.mutations.insertProspect, {
        userId,
        jobListingId,
        name: "Hiring Contact",
        email: job.email,
        title: job.title,
        company: job.company,
        source: "job_post",
        status: "verified",
      });

      const draft = await ctx.runAction(internal.outreach.generator.generateOutreachEmail, {
        userId,
        jobListingId,
        prospectId,
      });

      await ctx.runMutation(internal.pendingActions.create, {
        userId,
        actionType: "send_email",
        payload: {
          to: job.email,
          subject: draft.subject,
          body: draft.body,
          company: job.company,
          role: job.title,
          coverLetter: draft.body,
        },
        source: "web",
        applicationId: undefined,
        jobListingId,
      });

      console.log(`Direct-email outreach draft created for ${job.company} (${job.email})`);
      return;
    }

    // Enrichment fallback: find decision-maker contacts via Apollo/PDL
    // 1. Infer Roles
    const targetRoles = overrideRoles || inferDecisionMakerRoles(job.title);

    // 2. Determine Domain
    const companyDomain = overrideDomain || job.domain || extractDomain(job.url, job.company);

    console.log(`Using domain: ${companyDomain} and searching for roles: ${targetRoles.join(", ")}`);

    // 3. Search Apollo
    let prospects = await ctx.runAction(internal.enrichment.apollo.searchPeople, {
      company_domain: companyDomain,
      titles: targetRoles,
      limit: 3,
    });

    // 4. Fallback to PDL if no prospects found
    if (prospects.length === 0) {
      console.log("Apollo found no prospects, evaluating PDL fallback...");
      prospects = await ctx.runAction(internal.enrichment.pdl.searchPeople, {
        company: job.company,
        titles: targetRoles,
        limit: 3,
      });
    }

    if (prospects.length === 0) {
      console.log(`No prospects found for ${job.company} (${companyDomain})`);
      return;
    }

    // 5. Store first good prospect
    for (const p of prospects) {
      if (!p.email) {
        console.log(`Email missing for prospect: ${p.name}, skipping...`);
        continue;
      }

      console.log(`Selected prospect: ${p.name} (${p.title}) - ${p.email}`);

      // 6. Store Prospect
      const prospectId = await ctx.runMutation(internal.outreach.mutations.insertProspect, {
        userId,
        jobListingId,
        name: p.name,
        email: p.email,
        title: p.title,
        company: p.company,
        seniority: p.seniority,
        department: p.department,
        source: p.source,
        status: "verified",
        enrichmentData: p.raw,
      });

      // 7. Generate Outreach Draft
      const draft = await ctx.runAction(internal.outreach.generator.generateOutreachEmail, {
        userId,
        jobListingId,
        prospectId,
      });

      // 8. Create Pending Action for User Approval
      await ctx.runMutation(internal.pendingActions.create, {
        userId,
        actionType: "send_email",
        payload: {
          to: p.email,
          subject: draft.subject,
          body: draft.body,
          company: job.company,
          role: job.title,
          coverLetter: draft.body,
        },
        source: "web",
        applicationId: undefined,
        jobListingId,
      });

      console.log(`Outreach draft created for ${p.name} at ${job.company}`);
      break;
    }
  },
});
