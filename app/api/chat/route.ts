import { NextRequest } from "next/server"
import {
  streamText,
  type UIMessage,
  createUIMessageStream,
  createUIMessageStreamResponse,
  convertToModelMessages,
} from "ai"
import { vertex } from "@ai-sdk/google-vertex"
import { setAIContext } from "@auth0/ai-vercel"
import { errorSerializer, withInterruptions } from "@auth0/ai-vercel/interrupts"

import { githubActivityTool } from "@/lib/tools/github-activity"
import { githubReposTool } from "@/lib/tools/github-repos"
import { slackPostTool } from "@/lib/tools/slack-post"
import { gmailSendTool } from "@/lib/tools/gmail-send"
import { saveActionTool } from "@/lib/tools/save-action"

const SYSTEM_PROMPT = `You are DevStandup AI — an intelligent assistant that turns developer activity into actionable standups.

Your workflow:
1. When the user asks to generate a standup, use the githubActivityTool to fetch their recent GitHub activity.
   - If the user specifies repos (e.g. "check my activity in owner/repo"), pass them in the "repos" parameter as ["owner/repo"].
   - If no repos are specified, ask the user which repos to check, or search broadly across all repos.
   - Using specific repos is more reliable and faster than broad search.
2. Analyze the activity and generate a structured standup in this format:
   - **Yesterday**: What was accomplished (based on commits, merged PRs)
   - **Today**: What's planned (based on open PRs, issues)
   - **Blockers**: Any potential blockers (based on failing checks, stale PRs)
3. After generating the standup, propose distribution actions using saveActionTool:
   - For Slack: Use casual, team-friendly tone. Propose with confidence score and reasoning.
   - For Gmail: Use professional tone. Mark as isHighStakes: true. Explain that gmail.send scope is needed.
4. Each proposed action should include:
   - A confidence score (0-100) with grounded reasoning (e.g., "87% confident — based on 12 commits and 3 PRs")
   - An explanation of why the permission is required
   - The specific OAuth scope needed

IMPORTANT RULES:
- NEVER execute actions directly. Always propose them via saveActionTool for user approval.
- Gmail actions are ALWAYS high-stakes (isHighStakes: true).
- Slack actions are normal-stakes (isHighStakes: false).
- Always provide valid JSON arguments when calling tools.
- When generating standup content, be concise but informative.
- Adapt tone per platform: casual for Slack, professional for Gmail.

The current date and time is ${new Date().toISOString()}.`

export async function POST(req: NextRequest) {
  const { id, messages }: { id: string; messages: Array<UIMessage> } =
    await req.json()

  setAIContext({ threadID: id })

  const tools = {
    githubActivityTool,
    githubReposTool,
    slackPostTool,
    gmailSendTool,
    saveActionTool,
  }

  const modelMessages = await convertToModelMessages(messages)

  const stream = createUIMessageStream({
    originalMessages: messages,
    execute: withInterruptions(
      async ({ writer }) => {
        let toolError: {
          cause: unknown
          toolCallId: string
          toolName: string
          toolArgs: unknown
        } | null = null

        const result = streamText({
          model: vertex("gemini-2.5-flash"),
          system: SYSTEM_PROMPT,
          messages: modelMessages,
          tools: tools as any,
          onFinish: (output) => {
            if (output.finishReason === "tool-calls") {
              const lastContent = output.content[output.content.length - 1]
              if (lastContent?.type === "tool-error") {
                const { toolName, toolCallId, error, input } = lastContent
                console.log("[chat] tool error detected for:", toolName)
                toolError = {
                  cause: error,
                  toolCallId,
                  toolName,
                  toolArgs: input,
                }
              }
            }
          },
        })

        // Stream the response to the client (shows loading/progress)
        writer.merge(
          result.toUIMessageStream({
            sendReasoning: true,
          })
        )

        // Wait for completion to check for tool errors
        await result.steps

        // If a tool error was captured, throw it so errorSerializer handles it
        if (toolError) {
          throw toolError
        }
      },
      {
        messages,
        tools: tools as any,
      }
    ),
    onError: errorSerializer((err) => {
      console.error("Chat error:", err)
      return `An error occurred: ${(err as Error).message}`
    }),
  })

  return createUIMessageStreamResponse({ stream })
}
