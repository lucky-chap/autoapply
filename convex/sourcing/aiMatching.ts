"use node"
import { internalAction } from "../_generated/server"
import { internal } from "../_generated/api"
import { v } from "convex/values"
import { Id } from "../_generated/dataModel"
import { z } from "zod"
import { GoogleGenAI, Type } from "@google/genai"

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

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error("GEMINI_API_KEY not set, cannot run AI matching")
      return { matched: 0 }
    }

    const profileSummary = [
      `Skills: ${profile.skills.join(", ")}`,
      `Experience: ${profile.experience.map((e) => `${e.title} at ${e.company} (${e.years}yr)`).join("; ")}`,
      prefs?.targetRoles?.length
        ? `Target roles: ${prefs.targetRoles.join(", ")}`
        : "",
      prefs?.targetLocations?.length
        ? `Target locations: ${prefs.targetLocations.join(", ")}`
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
`

        const ai = new GoogleGenAI({ apiKey })

        const schema = {
          type: Type.OBJECT,
          properties: {
            score: {
              type: Type.INTEGER,
              description: "A match score from 0 to 100",
            },
            reasoning: {
              type: Type.STRING,
              description: "A short explanation for the score",
            },
          },
          required: ["score", "reasoning"],
        }

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: schema as any,
            temperature: 0.1,
          },
        })

        const resText = response.text

        if (!resText) throw new Error("Empty response from Gemini")

        // 1. Clean JSON: Remove markdown fences (if present) and whitespace
        const cleanJson = resText
          .replace(/^```json\s*\n?/, "")
          .replace(/```\s*$/, "")
          .trim()

        let parsed: any
        try {
          parsed = JSON.parse(cleanJson)
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
        await ctx.runMutation(internal.sourcing.store.createMatch, {
          userId,
          jobListingId: jobId,
          matchScore: score,
          matchReasoning: reasoning,
          status: score >= 60 ? "new" : "ignored",
        })

        if (score >= 60) {
          matched++
          console.log(
            `Match: ${job.title} at ${job.company} → score ${score} for user ${userId}`
          )
        }

        // 6s delay → 10 RPM, safely under the free-tier limit for gemini-2.5-flash
        await new Promise((resolve) => setTimeout(resolve, 6000))
      } catch (e) {
        console.error(`AI matching error for job ${jobId}:`, e)
      }
    }

    console.log(
      `AI matching for ${userId}: ${matched} matches from ${jobIds.length} jobs`
    )
    return { matched }
  },
})
