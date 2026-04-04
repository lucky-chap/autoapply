"use node"
import { internalAction } from "../_generated/server"
import { internal } from "../_generated/api"
import { v } from "convex/values"
import { Id } from "../_generated/dataModel"
import { z } from "zod"
import { callVertex } from "../../lib/vertex"

/**
 * Evaluate a batch of newly-fetched job listings against a single user's
 * resume profile and preferences. Creates userJobMatches for high-scoring jobs.
 */
export const evaluateJobsForUser = internalAction({
  args: {
    userId: v.string(),
    jobIds: v.array(v.id("jobListings")),
  },
  handler: async (ctx, { userId, jobIds }) => {
    // Load user profile + preferences
    const profile = await ctx.runQuery(
      internal.resumeProfiles.getByUserInternal,
      { userId }
    )
    if (!profile) {
      console.log(`Skipping AI matching for ${userId}: no resume profile`)
      return { matched: 0 }
    }

    const prefs = await ctx.runQuery(internal.preferences.getByUserInternal, {
      userId,
    })


    const profileSummary = [
      `Skills: ${profile.skills.join(", ")}`,
      `Experience: ${profile.experience.map((e) => `${e.title} at ${e.company} (${e.years}yr)`).join("; ")}`,
      prefs?.targetRoles?.length
        ? `Target roles: ${prefs.targetRoles.join(", ")}`
        : "",
      prefs?.targetLocations?.length
        ? `Preferred locations: ${prefs.targetLocations.join(", ")}`
        : "",
      prefs?.minSalary ? `Min salary: $${prefs.minSalary}` : "",
    ]
      .filter(Boolean)
      .join("\n")

    let matched = 0

    // Process jobs one at a time to stay within action limits
    for (const jobId of jobIds) {
      // Check if match already exists
      const alreadyMatched: boolean = await ctx.runQuery(
        internal.sourcing.store.hasMatch,
        { userId, jobListingId: jobId }
      )
      if (alreadyMatched) continue

      // Fetch the job listing via a query
      const job = await ctx.runQuery(internal.sourcing.queries.getJobById, {
        jobId,
      })
      if (!job) continue

      try {
        const prompt = `You are evaluating whether a job listing is a good match for a candidate.

CANDIDATE PROFILE:
${profileSummary}

JOB LISTING:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
${job.salary ? `Salary: ${job.salary}` : ""}
Description: ${job.description.slice(0, 3000)}

Analyze the match based on these criteria:
- Technical stack alignment
- Experience level match
- Remote/Location preference
- Industry relevance

Return ONLY a valid JSON object with:
{"score": number (0-100), "reasoning": "string explanation"}

Return ONLY the JSON object, NO markdown formatting.`

        const resText = await callVertex(prompt, 1000)

        if (!resText) throw new Error("Empty response from AI")

        // 1. Clean JSON: Remove markdown fences (if present) and whitespace
        const cleanJson = resText
          .replace(/^```json\s*\n?/, "")
          .replace(/```\s*$/, "")
          .trim()

        const jsonMatch = cleanJson.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          throw new Error("No JSON found in response")
        }

        let parsed: any
        try {
          parsed = JSON.parse(jsonMatch[0])
        } catch (err) {
          console.error(
            `AI match JSON parse error for job ${jobId}. Raw:`,
            resText
          )
          throw err
        }

        // 2. Validate Schema: Ensure we have the required fields
        const validationSchema = z.object({
          score: z.number().min(0).max(100),
          reasoning: z.string().optional(),
        })

        const validation = validationSchema.safeParse(parsed)
        if (!validation.success) {
          console.error(
            `AI match schema validation error for job ${jobId}:`,
            validation.error.format()
          )
          throw new Error("Invalid response format from AI")
        }

        const { score, reasoning = "" } = validation.data

        // Create a match record regardless of score (mark low scores as "ignored")
        // This prevents redundant AI evaluations in future cycles.
        const matchId: Id<"userJobMatches"> = await ctx.runMutation(
          internal.sourcing.store.createMatch,
          {
            userId,
            jobListingId: jobId,
            matchScore: score,
            matchReasoning: reasoning,
            status: score >= 60 ? "new" : "ignored",
          }
        )

        if (score >= 80) {
          // Trigger automated outreach for high-quality matches
          await ctx.scheduler.runAfter(
            0,
            internal.outreach.orchestrator.runPipelineForMatch,
            {
              userId,
              jobListingId: jobId,
              matchId,
            }
          )
        }

        if (score >= 60) {
          matched++
          console.log(
            `Match: ${job.title} at ${job.company} → score ${score} for user ${userId}`
          )
        }

        // 4s delay to stay within free-tier RPM limits
        await new Promise((resolve) => setTimeout(resolve, 4000))
      } catch (e: any) {
        // Stop entirely on quota exhaustion — no point burning through the loop
        if (
          e?.status === 429 ||
          e?.message?.includes("429") ||
          e?.message?.includes("RESOURCE_EXHAUSTED")
        ) {
          console.warn(
            `Quota exhausted after ${matched} matches for ${userId}, stopping early`
          )
          break
        }
        console.error(`AI matching error for job ${jobId}:`, e)
      }
    }

    console.log(
      `AI matching for ${userId}: ${matched} matches from ${jobIds.length} jobs`
    )
    return { matched }
  },
})
