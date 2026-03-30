import { TokenVaultError } from "@auth0/ai/interrupts"
import { tool } from "ai"
import { z } from "zod"
import { google } from "googleapis"

import { getAccessToken, withGmailWrite } from "@/lib/auth0-ai"

export const gmailSendTool = withGmailWrite(
  tool({
    description:
      "Send an email via Gmail. This is a HIGH-STAKES action that requires step-up authentication. Use this for sending standup updates or professional communications via email.",
    inputSchema: z.object({
      to: z.string().describe("Recipient email address"),
      subject: z.string().describe("Email subject line"),
      body: z
        .string()
        .describe(
          "Email body content. Use professional tone appropriate for email."
        ),
    }),
    execute: async ({ to, subject, body }) => {
      const accessToken = await getAccessToken()

      try {
        const auth = new google.auth.OAuth2()
        auth.setCredentials({ access_token: accessToken })

        const gmail = google.gmail({ version: "v1", auth })

        // Build RFC 2822 email
        const rawEmail = [
          `To: ${to}`,
          `Subject: ${subject}`,
          "Content-Type: text/html; charset=utf-8",
          "",
          body,
        ].join("\r\n")

        const encodedMessage = Buffer.from(rawEmail)
          .toString("base64")
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "")

        const result = await gmail.users.messages.send({
          userId: "me",
          requestBody: { raw: encodedMessage },
        })

        return {
          success: true,
          messageId: result.data.id,
          threadId: result.data.threadId,
          message: `Email sent successfully to ${to}`,
        }
      } catch (error) {
        const err = error as { code?: number }
        if (err.code === 401 || err.code === 403) {
          throw new TokenVaultError(
            "Authorization required to send email via Gmail. Please connect your Google account."
          )
        }
        throw error
      }
    },
  })
)
