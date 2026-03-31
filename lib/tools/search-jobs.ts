import { tool } from "ai"
import { z } from "zod"
import { convex, api, getAuthenticatedUser } from "./_context"

const parameters = z.object({
  status: z.enum(["new", "ignored", "approved", "applied"]).optional(),
})

export const searchJobsTool = tool({
  description: "Search for matched jobs based on user profile and preferences.",
  parameters: parameters as any,
  execute: async ({ status }: any) => {
    const user = await getAuthenticatedUser()
    return await convex.query(api.sourcing.userMatches.getMatchesForUser, {
      userId: user.sub,
      status,
    })
  },
} as any)
