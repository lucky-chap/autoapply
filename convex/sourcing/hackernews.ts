import { internalAction } from "../_generated/server"
import { internal } from "../_generated/api"
import { stripHtml, extractEmail, extractUrl } from "./textUtils"

const HN_API = "https://hacker-news.firebaseio.com/v0"

interface HNUser {
  id: string
  submitted: number[]
}

interface HNItem {
  id: number
  type: string
  title?: string
  text?: string
  time?: number
  kids?: number[]
  deleted?: boolean
  dead?: boolean
}

/**
 * Fetch and store jobs from the latest HN "Who is Hiring?" thread.
 * The thread is posted monthly by user "whoishiring" on the 1st.
 * Each top-level comment is a job posting.
 */
export const fetchAndStore = internalAction({
  args: {},
  handler: async (ctx) => {
    // 1. Find the latest "Who is hiring?" thread
    const threadId = await findLatestHiringThread()
    if (!threadId) {
      console.log("HN: could not find a recent Who is Hiring thread")
      return { inserted: 0, total: 0 }
    }

    // 2. Fetch the thread to get child comment IDs
    const thread = await fetchItem(threadId)
    if (!thread?.kids || thread.kids.length === 0) {
      console.log("HN: thread has no comments")
      return { inserted: 0, total: 0 }
    }

    console.log(`HN: found thread ${threadId} with ${thread.kids.length} comments`)

    // 3. Batch-fetch comments (groups of 20)
    const commentIds = thread.kids.slice(0, 500) // cap at 500
    let inserted = 0
    let total = 0

    for (let i = 0; i < commentIds.length; i += 20) {
      const batch = commentIds.slice(i, i + 20)
      const comments = await Promise.all(batch.map(fetchItem))

      for (const comment of comments) {
        if (!comment?.text || comment.deleted || comment.dead) continue

        const plainText = stripHtml(comment.text)
        if (plainText.length < 30) continue // skip very short/empty comments

        total++
        const parsed = parseHNJobPost(plainText, comment.id)
        const email = extractEmail(plainText)

        const added = await ctx.runMutation(
          internal.sourcing.store.insertIfNew,
          {
            externalId: String(comment.id),
            source: "hackernews",
            title: parsed.title,
            company: parsed.company,
            description: plainText.slice(0, 8000),
            url: parsed.url,
            location: parsed.location,
            salary: parsed.salary ?? undefined,
            category: "software-dev",
            postedAt: comment.time ? comment.time * 1000 : undefined,
            email: email ?? undefined,
            hasEmail: !!email,
          }
        )
        if (added) inserted++
      }
    }

    console.log(
      `HN: processed ${total} job posts from thread ${threadId}, inserted ${inserted} new`
    )
    return { inserted, total }
  },
})

/**
 * Find the most recent "Who is hiring?" thread by checking
 * the whoishiring user's recent submissions.
 */
async function findLatestHiringThread(): Promise<number | null> {
  try {
    const res = await fetch(`${HN_API}/user/whoishiring.json`)
    if (!res.ok) return null
    const user: HNUser = await res.json()

    // Check the most recent 6 submissions (covers 2 months of threads)
    const candidates = user.submitted.slice(0, 6)
    for (const id of candidates) {
      const item = await fetchItem(id)
      if (
        item?.title &&
        /who is hiring/i.test(item.title) &&
        !/who wants to be hired/i.test(item.title) &&
        !/freelancer/i.test(item.title)
      ) {
        // Verify it's from the current or previous month
        if (item.time) {
          const threadDate = new Date(item.time * 1000)
          const now = new Date()
          const monthsAgo =
            (now.getFullYear() - threadDate.getFullYear()) * 12 +
            (now.getMonth() - threadDate.getMonth())
          if (monthsAgo <= 1) return item.id
        }
      }
    }
  } catch (e) {
    console.error("HN: error finding hiring thread:", e)
  }
  return null
}

async function fetchItem(id: number): Promise<HNItem | null> {
  try {
    const res = await fetch(`${HN_API}/item/${id}.json`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/**
 * Parse a HN job posting comment.
 * Common format: "Company | Role | Location | Remote | Salary"
 * followed by description paragraphs.
 */
function parseHNJobPost(
  text: string,
  commentId: number
): {
  company: string
  title: string
  location: string
  url: string
  salary: string | null
} {
  const lines = text.split("\n").filter((l) => l.trim())
  const firstLine = lines[0] || ""

  // Try pipe-delimited format
  if (firstLine.includes("|")) {
    const parts = firstLine.split("|").map((p) => p.trim())
    const company = parts[0] || "Unknown"
    const title = parts[1] || firstLine
    const location = parts[2] || "Remote"

    // Look for salary in remaining parts
    let salary: string | null = null
    for (const part of parts.slice(3)) {
      if (/\$|k\b|salary|£|€|\d{2,3},?\d{3}/i.test(part)) {
        salary = part
        break
      }
    }

    const url = extractUrl(text) || `https://news.ycombinator.com/item?id=${commentId}`

    return { company, title, location, url, salary }
  }

  // Fallback: no pipe format — use first line as title, try to extract company
  const url = extractUrl(text) || `https://news.ycombinator.com/item?id=${commentId}`
  return {
    company: firstLine.slice(0, 80),
    title: firstLine.slice(0, 120),
    location: "Unknown",
    url,
    salary: null,
  }
}
