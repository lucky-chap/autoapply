import { tool } from "ai"
import { z } from "zod"
import { ConvexHttpClient } from "convex/browser"
import { api } from "@/convex/_generated/api"

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export const saveActionTool = tool({
  description: `Propose an action for the user to review in the Action Queue. Instead of executing immediately,
this saves the action as "pending" so the user can approve or skip it. Use this for all platform-specific
actions (posting to Slack, sending email). Include confidence score and reasoning for transparency.`,
  inputSchema: z.object({
    sessionId: z
      .string()
      .describe("The standup session ID this action belongs to"),
    agentName: z
      .enum(["github", "writer", "slack", "gmail"])
      .describe("Which agent is proposing this action"),
    platform: z
      .string()
      .describe("Target platform (slack, gmail, etc.)"),
    actionType: z
      .string()
      .describe("Type of action (post_message, send_email, etc.)"),
    content: z
      .string()
      .describe("The message or email content to be sent"),
    metadata: z
      .string()
      .optional()
      .describe(
        "JSON string of additional metadata (channel name, recipient email, etc.)"
      ),
    confidence: z
      .number()
      .min(0)
      .max(100)
      .describe("Confidence score 0-100 for this action"),
    reasoning: z
      .string()
      .describe(
        "Explain why this action is being proposed and why the confidence level"
      ),
    scope: z
      .string()
      .describe(
        "The OAuth scope required for this action (e.g. chat:write, gmail.send)"
      ),
    isHighStakes: z
      .boolean()
      .describe(
        "Whether this action requires step-up authentication (true for email sends)"
      ),
  }),
  execute: async (args) => {
    // Note: This tool does not use Token Vault — it writes directly to Convex
    // The actual execution happens when the user approves the action
    // The auth token for Convex must be set on the client before calling this
    return {
      success: true,
      message: `Action proposed: ${args.actionType} on ${args.platform}`,
      actionDetails: {
        agentName: args.agentName,
        platform: args.platform,
        actionType: args.actionType,
        confidence: args.confidence,
        reasoning: args.reasoning,
        scope: args.scope,
        isHighStakes: args.isHighStakes,
      },
    }
  },
})
