import { internalAction } from "./_generated/server"
import { getGmailTokenViaTokenVault } from "./tokenVault"
import { v } from "convex/values"

/**
 * Calendar Utilities
 * Uses the Google Calendar API to check for conflicts and add events.
 */

export const getCalendarConflicts = internalAction({
  args: {
    userId: v.string(),
    startTime: v.string(), // ISO string
    endTime: v.string(),   // ISO string
  },
  handler: async (ctx, args) => {
    const accessToken = await getGmailTokenViaTokenVault(ctx, args.userId)

    const params = new URLSearchParams({
      timeMin: args.startTime,
      timeMax: args.endTime,
      singleEvents: "true",
      orderBy: "startTime",
    })

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )

    if (!res.ok) {
      const err = await res.text()
      console.error("[calendar] getCalendarConflicts failed:", res.status, err)
      if (res.status === 403 && err.includes("SCOPE_INSUFFICIENT")) {
        throw new Error("MISSING_CALENDAR_SCOPE")
      }
      throw new Error(`Google Calendar API error: ${err}`)
    }

    const data = await res.json()
    console.log(`[calendar] Found ${data.items?.length || 0} events`)
    return data.items || []
  },
})

export const createCalendarEvent = internalAction({
  args: {
    userId: v.string(),
    summary: v.string(),
    description: v.string(),
    startTime: v.string(), // ISO string
    endTime: v.string(),   // ISO string
  },
  handler: async (ctx, args) => {
    const accessToken = await getGmailTokenViaTokenVault(ctx, args.userId)

    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: args.summary,
          description: args.description,
          start: { dateTime: args.startTime },
          end: { dateTime: args.endTime },
        }),
      }
    )

    if (!res.ok) {
      const err = await res.text()
      if (res.status === 403 && err.includes("SCOPE_INSUFFICIENT")) {
        throw new Error("MISSING_CALENDAR_SCOPE")
      }
      throw new Error(`Google Calendar API error: ${err}`)
    }

    return await res.json()
  },
})
