import { internalAction } from "../_generated/server"
import { internal } from "../_generated/api"
import { v } from "convex/values"
import { Id } from "../_generated/dataModel"

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

Please output a JSON object with:
{
  "score": number (0-100),
  "reasoning": "short explanation"
}

Match Criteria:
- Technical stack alignment
- Experience level match
- Remote/Location preference
- Industry relevance`

        const model = "gemini-2.5-flash"
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: 500,
              temperature: 0.1,
              responseMimeType: "application/json",
            },
          }),
        })

        if (!response.ok) {
          const err = await response.text()
          throw new Error(`Gemini API error (${response.status}): ${err}`)
        }

        const data = (await response.json()) as any
        const resText = data.candidates?.[0]?.content?.parts?.[0]?.text

        if (!resText) throw new Error("Empty response from Gemini")

        // Strip markdown fences or extra whitespace that Gemini sometimes adds
        const cleanJson = resText.replace(/```json\s*\n?/g, "").replace(/```\s*$/g, "").trim()
        const parsed = JSON.parse(cleanJson)
        const score = typeof parsed.score === "number" ? parsed.score : 0
        const reasoning = String(parsed.reasoning || "")

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
