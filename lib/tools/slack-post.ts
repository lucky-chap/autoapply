import { TokenVaultError } from "@auth0/ai/interrupts"
import { tool } from "ai"
import { z } from "zod"
import { WebClient } from "@slack/web-api"

import { getAccessToken, withSlack } from "@/lib/auth0-ai"

export const slackPostTool = withSlack(
  tool({
    description:
      "Post a message to a Slack channel. Use this to share standup updates with your team on Slack. Requires chat:write scope.",
    inputSchema: z.object({
      channel: z
        .string()
        .describe("The Slack channel name or ID to post to (e.g. #general)"),
      message: z
        .string()
        .describe("The message content to post. Use Slack markdown formatting."),
    }),
    execute: async ({ channel, message }) => {
      const accessToken = await getAccessToken()

      try {
        const client = new WebClient(accessToken)

        const result = await client.chat.postMessage({
          channel,
          text: message,
        })

        return {
          success: true,
          channel: result.channel,
          timestamp: result.ts,
          message: "Message posted successfully to Slack",
        }
      } catch (error) {
        const err = error as { data?: { error?: string } }
        if (
          err.data?.error === "invalid_auth" ||
          err.data?.error === "token_revoked"
        ) {
          throw new TokenVaultError(
            "Authorization required to post to Slack. Please connect your Slack account."
          )
        }
        throw error
      }
    },
  })
)
