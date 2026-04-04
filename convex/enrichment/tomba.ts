"use node"
import { internalAction } from "../_generated/server"
import { v } from "convex/values"

const TOMBA_API_KEY = process.env.TOMBA_API_KEY
const TOMBA_SECRET = process.env.TOMBA_SECRET

export const searchPeople = internalAction({
  args: {
    domain: v.string(),
    titles: v.array(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (_ctx, { domain, titles, limit }) => {
    if (!TOMBA_API_KEY || !TOMBA_SECRET) {
      console.warn("TOMBA_API_KEY or TOMBA_SECRET not set")
      return []
    }

    const cap = limit ?? 5
    const params = new URLSearchParams({
      domain,
      limit: String(cap),
    })

    const response = await fetch(
      `https://api.tomba.io/v1/domain-search/?${params}`,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Tomba-Key": TOMBA_API_KEY,
          "X-Tomba-Secret": TOMBA_SECRET,
        },
      }
    )

    if (!response.ok) {
      console.error(`Tomba API error: ${response.status} ${response.statusText}`)
      return []
    }

    const data = await response.json()
    const emails = data.data?.emails || []

    console.log(`Tomba returned ${emails.length} emails for ${domain}`)

    // Filter by title relevance
    const lowerTitles = titles.map((t) => t.toLowerCase())
    const matched = emails.filter((e: any) => {
      const pos = (e.position || "").toLowerCase()
      return lowerTitles.some((t) => pos.includes(t))
    })

    const results = matched.length > 0 ? matched : emails.slice(0, cap)

    return results.map((e: any) => ({
      name:
        [e.first_name, e.last_name].filter(Boolean).join(" ") || "Unknown",
      email: e.email,
      title: e.position || "",
      company: e.company || domain,
      seniority: e.seniority || "",
      department: e.department || "",
      source: "manual" as const,
      raw: e,
    }))
  },
})
