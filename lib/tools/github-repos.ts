import { Octokit, RequestError } from "octokit"
import { TokenVaultError } from "@auth0/ai/interrupts"
import { tool } from "ai"
import { z } from "zod"

import { getAccessToken, withGitHub } from "@/lib/auth0-ai"

export const githubReposTool = withGitHub(
  tool({
    description:
      "List the authenticated user's GitHub repositories, sorted by most recently pushed. Use this to help the user pick which repos to include in their standup.",
    inputSchema: z.object({
      limit: z
        .number()
        .optional()
        .describe("Max repos to return. Defaults to 20."),
    }),
    execute: async ({ limit }) => {
      const accessToken = await getAccessToken()

      try {
        const octokit = new Octokit({ auth: accessToken })

        const { data: repos } =
          await octokit.rest.repos.listForAuthenticatedUser({
            sort: "pushed",
            direction: "desc",
            per_page: limit ?? 20,
          })

        return repos.map((r) => ({
          fullName: r.full_name,
          name: r.name,
          private: r.private,
          pushedAt: r.pushed_at,
          description: r.description,
        }))
      } catch (error) {
        if (error instanceof RequestError && error.status === 401) {
          throw new TokenVaultError(
            "Authorization required to access your GitHub repos. Please connect your GitHub account."
          )
        }
        throw error
      }
    },
  })
)
