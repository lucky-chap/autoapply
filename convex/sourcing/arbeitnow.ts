import { internalAction } from "../_generated/server"
import { internal } from "../_generated/api"
import { v } from "convex/values"
import { stripHtml, extractEmail } from "./textUtils"

/**
 * Arbeitnow API integration.
 * Free API, no key required: https://www.arbeitnow.com/api/job-board-api
 * Returns { data: [...] } with job objects.
 */

interface ArbeitnowJob {
  slug: string
  company_name: string
  title: string
  description: string
  remote: boolean
  url: string
  tags: string[]
  job_types: string[]
  location: string
  created_at: number
}

interface ArbeitnowResponse {
  data: ArbeitnowJob[]
}

/**
 * Fetch jobs from Arbeitnow and store new listings.
 * The API doesn't support search filtering, so we fetch the full listing
 * and let the AI matcher handle relevance scoring.
 */
export const fetchAndStore = internalAction({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const pageLimit = limit ?? 100

    let response: Response
    try {
      response = await fetch("https://www.arbeitnow.com/api/job-board-api")
    } catch (err) {
      console.error("Arbeitnow API fetch error:", err)
      return { inserted: 0, total: 0 }
    }

    if (!response.ok) {
      console.error(`Arbeitnow API error: ${response.status}`)
      return { inserted: 0, total: 0 }
    }

    let data: ArbeitnowResponse
    try {
      data = await response.json()
    } catch {
      console.error("Arbeitnow: invalid JSON response")
      return { inserted: 0, total: 0 }
    }

    const jobs = (data.data ?? []).slice(0, pageLimit)

    let inserted = 0
    for (const job of jobs) {
      const description = stripHtml(job.description).slice(0, 8000)
      const email = extractEmail(description)

      const domain =
        job.company_name.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com"

      const added: boolean = await ctx.runMutation(
        internal.sourcing.store.insertIfNew,
        {
          externalId: job.slug,
          source: "arbeitnow",
          title: job.title,
          company: job.company_name,
          description,
          url: job.url,
          location: job.location || (job.remote ? "Remote" : "Unknown"),
          category: job.tags?.[0] || undefined,
          postedAt: job.created_at ? job.created_at * 1000 : undefined,
          email: email ?? undefined,
          hasEmail: !!email,
          domain,
        }
      )
      if (added) inserted++
    }

    console.log(
      `Arbeitnow: fetched ${jobs.length} jobs, inserted ${inserted} new`
    )
    return { inserted, total: jobs.length }
  },
})
