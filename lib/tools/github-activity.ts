import { Octokit, RequestError } from "octokit"
import { TokenVaultError } from "@auth0/ai/interrupts"
import { tool } from "ai"
import { z } from "zod"

import { getAccessToken, withGitHub } from "@/lib/auth0-ai"

interface CommitInfo {
  repo: string
  message: string
  sha: string
}

interface PRInfo {
  repo: string
  title: string
  action: string
  number: number
}

interface IssueInfo {
  repo: string
  title: string
  action: string
  number: number
}

export const githubActivityTool = withGitHub(
  tool({
    description:
      "Fetch the authenticated user's recent GitHub activity including commits, pull requests, and issues. Can target specific repos or search across all repos.",
    inputSchema: z.object({
      hoursBack: z
        .number()
        .optional()
        .describe("How many hours of activity to fetch. Defaults to 24."),
      repos: z
        .array(z.string())
        .optional()
        .describe(
          'Specific repos to check, in "owner/repo" format (e.g. ["octocat/hello-world"]). When provided, fetches commits directly from each repo for maximum reliability. If omitted, searches across all repos.'
        ),
    }),
    execute: async ({ hoursBack, repos }) => {
      console.log("[github-activity] Tool execute called, repos:", repos)
      let accessToken: string
      try {
        accessToken = await getAccessToken()
        console.log("[github-activity] Got access token:", accessToken ? "yes" : "NO TOKEN")
      } catch (err) {
        console.error("[github-activity] getAccessToken failed:", err)
        throw err
      }

      try {
        const octokit = new Octokit({ auth: accessToken })
        const hours = hoursBack ?? 24

        const since = new Date(
          Date.now() - hours * 60 * 60 * 1000
        ).toISOString()

        const { data: user } = await octokit.rest.users.getAuthenticated()
        const username = user.login

        // Build list of data-fetching promises
        const fetchers: Promise<{
          commits: CommitInfo[]
          pullRequests: PRInfo[]
          issues: IssueInfo[]
        }>[] = []

        if (repos && repos.length > 0) {
          // When specific repos are provided, use the Repos API for each
          // (most reliable — directly lists commits from the repo)
          for (const repoFullName of repos) {
            fetchers.push(fetchFromRepoAPI(octokit, repoFullName, username, since))
          }
        } else {
          // Broad search: Events API + Search API
          fetchers.push(
            fetchFromEventsAPI(octokit, username, since).then((r) => ({
              ...r,
            }))
          )
          fetchers.push(
            fetchCommitsFromSearch(octokit, username, since).then(
              (commits) => ({ commits, pullRequests: [], issues: [] })
            )
          )
        }

        // Always search for PRs and issues (works for both modes)
        fetchers.push(
          fetchPRsFromSearch(octokit, username, since, repos).then(
            ({ pullRequests, issues }) => ({
              commits: [],
              pullRequests,
              issues,
            })
          )
        )

        const results = await Promise.allSettled(fetchers)

        // Merge and deduplicate all results
        const commitMap = new Map<string, CommitInfo>()
        const prMap = new Map<string, PRInfo>()
        const issueMap = new Map<string, IssueInfo>()

        for (const result of results) {
          if (result.status === "rejected") {
            console.warn("[github-activity] A fetcher failed:", result.reason)
            continue
          }
          const { commits, pullRequests, issues } = result.value
          for (const c of commits) {
            if (!commitMap.has(c.sha)) commitMap.set(c.sha, c)
          }
          for (const pr of pullRequests) {
            const key = `${pr.repo}#${pr.number}`
            if (!prMap.has(key)) prMap.set(key, pr)
          }
          for (const issue of issues) {
            const key = `${issue.repo}#${issue.number}`
            if (!issueMap.has(key)) issueMap.set(key, issue)
          }
        }

        const commits = Array.from(commitMap.values())
        const pullRequests = Array.from(prMap.values())
        const issues = Array.from(issueMap.values())

        return {
          summary: {
            totalCommits: commits.length,
            totalPRs: pullRequests.length,
            totalIssues: issues.length,
            period: `Last ${hours} hours`,
            ...(repos && { repos }),
          },
          commits: commits.slice(0, 20),
          pullRequests: pullRequests.slice(0, 10),
          issues: issues.slice(0, 10),
        }
      } catch (error) {
        console.error("[github-activity] Octokit error:", error)
        if (error instanceof RequestError && error.status === 401) {
          throw new TokenVaultError(
            "Authorization required to access your GitHub activity. Please connect your GitHub account."
          )
        }
        throw error
      }
    },
  })
)

/** Fetch commits directly from a specific repo via the Repos API (most reliable) */
async function fetchFromRepoAPI(
  octokit: Octokit,
  repoFullName: string,
  username: string,
  since: string
): Promise<{ commits: CommitInfo[]; pullRequests: PRInfo[]; issues: IssueInfo[] }> {
  const [owner, repo] = repoFullName.split("/")

  const { data: repoCommits } = await octokit.rest.repos.listCommits({
    owner,
    repo,
    author: username,
    since,
    per_page: 30,
  })

  const commits: CommitInfo[] = repoCommits.map((c) => ({
    repo: repoFullName,
    message: c.commit.message.split("\n")[0],
    sha: c.sha.substring(0, 7),
  }))

  // Also fetch recent PRs for this specific repo
  const { data: prs } = await octokit.rest.pulls.list({
    owner,
    repo,
    state: "all",
    sort: "updated",
    direction: "desc",
    per_page: 10,
  })

  const cutoff = new Date(since).getTime()
  const pullRequests: PRInfo[] = prs
    .filter(
      (pr) =>
        pr.user?.login === username &&
        new Date(pr.updated_at).getTime() > cutoff
    )
    .map((pr) => ({
      repo: repoFullName,
      title: pr.title,
      action: pr.state,
      number: pr.number,
    }))

  return { commits, pullRequests, issues: [] }
}

/** Fetch activity from the Events API (fallback for broad search) */
async function fetchFromEventsAPI(
  octokit: Octokit,
  username: string,
  since: string
) {
  const { data: events } =
    await octokit.rest.activity.listEventsForAuthenticatedUser({
      username,
      per_page: 100,
    })

  const cutoff = new Date(since).getTime()
  const recentEvents = events.filter(
    (e) => new Date(e.created_at ?? "").getTime() > cutoff
  )

  const commits: CommitInfo[] = []
  const pullRequests: PRInfo[] = []
  const issues: IssueInfo[] = []

  for (const event of recentEvents) {
    const repo = event.repo.name
    const payload = event.payload as Record<string, unknown>

    if (event.type === "PushEvent") {
      const eventCommits =
        (payload.commits as Array<Record<string, string>>) ?? []
      for (const c of eventCommits) {
        commits.push({
          repo,
          message: c.message?.split("\n")[0] ?? "",
          sha: c.sha?.substring(0, 7) ?? "",
        })
      }
    } else if (event.type === "PullRequestEvent") {
      const pr = payload.pull_request as Record<string, unknown>
      pullRequests.push({
        repo,
        title: (pr?.title as string) ?? "",
        action: (payload.action as string) ?? "",
        number: (pr?.number as number) ?? 0,
      })
    } else if (event.type === "IssuesEvent") {
      const issue = payload.issue as Record<string, unknown>
      issues.push({
        repo,
        title: (issue?.title as string) ?? "",
        action: (payload.action as string) ?? "",
        number: (issue?.number as number) ?? 0,
      })
    }
  }

  return { commits, pullRequests, issues }
}

/** Fetch commits via the Search API (reliable for broad search) */
async function fetchCommitsFromSearch(
  octokit: Octokit,
  username: string,
  since: string
): Promise<CommitInfo[]> {
  const sinceDate = since.split("T")[0]

  const { data } = await octokit.rest.search.commits({
    q: `author:${username} committer-date:>=${sinceDate}`,
    sort: "committer-date",
    order: "desc",
    per_page: 30,
  })

  const cutoff = new Date(since).getTime()

  return data.items
    .filter((item) => {
      const date = item.commit.committer?.date
      return date && new Date(date).getTime() > cutoff
    })
    .map((item) => ({
      repo: item.repository.full_name,
      message: item.commit.message.split("\n")[0],
      sha: item.sha.substring(0, 7),
    }))
}

/** Fetch PRs and issues via the Search API */
async function fetchPRsFromSearch(
  octokit: Octokit,
  username: string,
  since: string,
  repos?: string[]
): Promise<{ pullRequests: PRInfo[]; issues: IssueInfo[] }> {
  const sinceDate = since.split("T")[0]

  // If specific repos provided, add repo qualifiers
  const repoFilter = repos?.length
    ? " " + repos.map((r) => `repo:${r}`).join(" ")
    : ""

  const [prsResult, issuesResult] = await Promise.allSettled([
    octokit.rest.search.issuesAndPullRequests({
      q: `author:${username} type:pr updated:>=${sinceDate}${repoFilter}`,
      sort: "updated",
      order: "desc",
      per_page: 20,
    }),
    octokit.rest.search.issuesAndPullRequests({
      q: `author:${username} type:issue updated:>=${sinceDate}${repoFilter}`,
      sort: "updated",
      order: "desc",
      per_page: 20,
    }),
  ])

  const pullRequests: PRInfo[] = []
  if (prsResult.status === "fulfilled") {
    for (const item of prsResult.value.data.items) {
      const urlParts = item.html_url.split("/")
      const repo = `${urlParts[3]}/${urlParts[4]}`
      pullRequests.push({
        repo,
        title: item.title,
        action: item.state,
        number: item.number,
      })
    }
  }

  const issues: IssueInfo[] = []
  if (issuesResult.status === "fulfilled") {
    for (const item of issuesResult.value.data.items) {
      const urlParts = item.html_url.split("/")
      const repo = `${urlParts[3]}/${urlParts[4]}`
      issues.push({
        repo,
        title: item.title,
        action: item.state,
        number: item.number,
      })
    }
  }

  return { pullRequests, issues }
}
