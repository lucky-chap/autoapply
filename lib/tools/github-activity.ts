import { Octokit, RequestError } from "octokit"
import { TokenVaultError } from "@auth0/ai/interrupts"
import { tool } from "ai"
import { z } from "zod"

import { getAccessToken, withGitHub } from "@/lib/auth0-ai"

export const githubActivityTool = withGitHub(
  tool({
    description:
      "Fetch the authenticated user's recent GitHub activity including commits, pull requests, and issues from the last 24 hours",
    inputSchema: z.object({
      hoursBack: z
        .number()
        .optional()
        .describe("How many hours of activity to fetch. Defaults to 24."),
    }),
    execute: async ({ hoursBack }) => {
      console.log("[github-activity] Tool execute called")
      let accessToken: string
      try {
        accessToken = await getAccessToken()
        console.log("[github-activity] Got access token:", accessToken ? "yes (length: " + accessToken.length + ")" : "NO TOKEN")
      } catch (err) {
        console.error("[github-activity] getAccessToken failed:", err)
        throw err
      }

      try {
        const octokit = new Octokit({ auth: accessToken })

        const since = new Date(
          Date.now() - (hoursBack ?? 24) * 60 * 60 * 1000
        ).toISOString()

        // Fetch recent events
        const { data: events } =
          await octokit.rest.activity.listEventsForAuthenticatedUser({
            username: (await octokit.rest.users.getAuthenticated()).data.login,
            per_page: 50,
          })

        const cutoff = new Date(since).getTime()
        const recentEvents = events.filter(
          (e) => new Date(e.created_at ?? "").getTime() > cutoff
        )

        const commits: Array<{
          repo: string
          message: string
          sha: string
        }> = []
        const pullRequests: Array<{
          repo: string
          title: string
          action: string
          number: number
        }> = []
        const issues: Array<{
          repo: string
          title: string
          action: string
          number: number
        }> = []

        for (const event of recentEvents) {
          const repo = event.repo.name
          const payload = event.payload as Record<string, unknown>

          if (event.type === "PushEvent") {
            const eventCommits = (payload.commits as Array<Record<string, string>>) ?? []
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

        return {
          summary: {
            totalCommits: commits.length,
            totalPRs: pullRequests.length,
            totalIssues: issues.length,
            period: `Last ${hoursBack ?? 24} hours`,
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
