import { internalAction } from "../_generated/server"
import { internal } from "../_generated/api"
import { v } from "convex/values"
import { stripHtml, extractEmail } from "./textUtils"

/**
 * Remotive API integration.
 * Docs: https://remotive.com/api/remote-jobs
 * Returns { jobs: [...] } with fields:
 *   id, url, title, company_name, category, job_type,
 *   publication_date, candidate_required_location, salary, description
 */

interface RemotiveJob {
  id: number
  url: string
  title: string
  company_name: string
  category: string
  job_type: string
  publication_date: string
  candidate_required_location: string
  salary: string
  description: string
}

interface RemotiveResponse {
  "job-count": number
  jobs: RemotiveJob[]
}

/**
 * Fetch remote jobs from Remotive matching a search keyword.
 * Normalizes results into our standard jobListings format and
 * inserts only net-new listings (deduped by source + externalId).
 */
export const fetchAndStore = internalAction({
  args: { search: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { search, limit }) => {
    const pageLimit = limit ?? 50
    const encoded = encodeURIComponent(search)
    let url = `https://remotive.com/api/remote-jobs?search=${encoded}&limit=${pageLimit}`

    let response = await fetch(url)
    if (!response.ok) {
      console.error(`Remotive API error: ${response.status}`)
      return { inserted: 0, total: 0 }
    }

    let data: RemotiveResponse = await response.json()
    let jobs = data.jobs ?? []

    // Fallback: If 0 jobs found for a highly specific role, fetch a broader category
    if (jobs.length === 0) {
      console.log(`Remotive: 0 jobs for "${search}", falling back to category=software-dev...`)
      url = `https://remotive.com/api/remote-jobs?category=software-dev&limit=${pageLimit}`
      response = await fetch(url)
      if (response.ok) {
        data = await response.json()
        jobs = data.jobs ?? []
      }
    }

    let inserted = 0
    for (const job of jobs) {
      const description = stripHtml(job.description).slice(0, 8000)
      const email = extractEmail(description)

      // Simple Domain Inference (can be improved with AI)
      const domain = job.company_name.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com";
      const department = job.category || "Engineering";

      const added: boolean = await ctx.runMutation(
        internal.sourcing.store.insertIfNew,
        {
          externalId: String(job.id),
          source: "remotive",
          title: job.title,
          company: job.company_name,
          description,
          url: job.url,
          location: job.candidate_required_location || "Remote",
          salary: job.salary || undefined,
          category: job.category || undefined,
          postedAt: job.publication_date
            ? new Date(job.publication_date).getTime()
            : undefined,
          email: email ?? undefined,
          hasEmail: !!email,
          domain,
          department,
        }
      )
      if (added) inserted++
    }

    console.log(
      `Remotive: fetched ${jobs.length} jobs for "${search}", inserted ${inserted} new`
    )
    return { inserted, total: jobs.length }
  },
})
