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

import { searchJobsTool } from "@/lib/tools/search-jobs"
import { extractJobInfoTool } from "@/lib/tools/extract-job-info"
import { generateCoverLetterTool } from "@/lib/tools/generate-cover-letter"
import { getMyApplicationsTool } from "@/lib/tools/get-my-applications"
import { getMyResumeTool } from "@/lib/tools/get-my-resume"
import { getMyPreferencesTool } from "@/lib/tools/get-my-preferences"
import { sendApplicationTool } from "@/lib/tools/send-application"
import { checkInboxTool } from "@/lib/tools/check-inbox"

const SYSTEM_PROMPT = `
You are AutoApply AI — a specialized assistant for job application automation.
Your goal is to help users find jobs, extract information from job postings, generate high-quality cover letters, and manage applications.

### Core Capabilities:
1. **Find Jobs**: Use searchJobsTool to show users matched jobs from their personalized feed.
2. **Process Job Postings**: When a user pastes a job description, use extractJobInfoTool to get the company, role, and recruiter email.
3. **Generate Cover Letters**: Use generateCoverLetterTool to create professional cover letters tailored to the user's resume and a specific job.
4. **Manage Applications**:
   - Use getMyApplicationsTool to list current applications and their statuses.
   - Use getMyResumeTool and getMyPreferencesTool to access user data.
5. **Security & Consent**:
   - **CRITICAL**: Always ask for EXPLICIT user confirmation before calling sendApplicationTool. Summarize what you will send (recipient, company, role).
   - sendApplicationTool and checkInboxTool require Gmail access via Auth0 Token Vault.
6. **Inbox Monitoring**: Use checkInboxTool to look for recruiter replies and automatically update application statuses in the database.

### Guidelines:
- If the user doesn't have a resume uploaded (getMyResumeTool returns null), kindly ask them to upload one on the dashboard.
- When extracting job info, if the email is missing, ask the user if they know the recruiter's email.
- Be professional, encouraging, and highly efficient.
- Use tools whenever possible to provide grounded, real-time data.

The current date and time is ${new Date().toISOString()}.
`;

export async function POST(req: NextRequest) {
  const { id, messages }: { id: string; messages: Array<UIMessage> } =
    await req.json()

  setAIContext({ threadID: id })

  const tools = {
    searchJobsTool,
    extractJobInfoTool,
    generateCoverLetterTool,
    getMyApplicationsTool,
    getMyResumeTool,
    getMyPreferencesTool,
    sendApplicationTool,
    checkInboxTool,
  }

  const modelMessages = await convertToModelMessages(messages)

  const stream = createUIMessageStream({
    originalMessages: messages,
    execute: withInterruptions(
      async ({ writer }) => {
        let toolError: any = null

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

        writer.merge(
          result.toUIMessageStream({
            sendReasoning: true,
          })
        )

        await result.steps

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
