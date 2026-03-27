import { internalAction } from "./_generated/server"
import { internal } from "./_generated/api"
import { v } from "convex/values"

/**
 * OpenClaw notification helper.
 * Sends messages to the user's self-hosted OpenClaw instance via the Gateway API.
 */

export const sendNotification = internalAction({
  args: {
    userId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, { userId, message }) => {
    const settings = await ctx.runQuery(
      internal.userSettings.getByUserInternal,
      { userId }
    )

    if (
      !settings?.openclawEnabled ||
      !settings.openclawGatewayUrl ||
      !settings.openclawGatewayToken
    ) {
      return // OpenClaw not configured or disabled
    }

    const gatewayUrl = settings.openclawGatewayUrl.replace(/\/+$/, "")

    try {
      const res = await fetch(`${gatewayUrl}/api/sessions/main/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.openclawGatewayToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: "user",
          content: message,
        }),
      })

      if (!res.ok) {
        const err = await res.text()
        console.error(`[openclaw] Failed to send notification: ${res.status} ${err}`)
      }
    } catch (err) {
      console.error(`[openclaw] Network error sending notification: ${err}`)
    }
  },
})

// Notification formatters for different event types

export function formatApplicationSent(company: string, role: string): string {
  return `[AutoApply] Application sent to ${company} for ${role}.`
}

export function formatReplyReceived(
  company: string,
  role: string,
  status: string
): string {
  return `[AutoApply] Reply received from ${company} (${role}). Status: ${status}.`
}

export function formatFollowUpSent(company: string, role: string): string {
  return `[AutoApply] Follow-up email sent to ${company} for ${role}.`
}

export function formatInterviewRequest(
  company: string,
  role: string,
  proposedTimes: string[]
): string {
  const times =
    proposedTimes.length > 0
      ? `\nProposed times: ${proposedTimes.join(", ")}`
      : ""
  return `[AutoApply] Interview request from ${company} for ${role}!${times}`
}
