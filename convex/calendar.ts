import { internalAction } from "./_generated/server"
import { internalMutation, internalQuery } from "./_generated/server"
import { getGmailTokenViaTokenVault } from "./tokenVault"
import { v } from "convex/values"

/**
 * Calendar Utilities
 * Uses the Google Calendar API to check for conflicts and add events.
 */

// ── Pure helper: analyze availability from calendar events ──

interface CalendarEvent {
  summary?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
}

interface SlotInfo {
  label: string
  start: string // ISO
  end: string   // ISO
}

interface ProposedTimeStatus {
  label: string
  available: boolean | null
}

export interface AvailabilityResult {
  events: { summary: string; start: string; label: string }[]
  proposedTimeStatus: ProposedTimeStatus[]
  suggestedSlots: SlotInfo[]
}

function parseProposedTime(timeStr: string, referenceDate: Date): Date | null {
  // Try direct Date.parse first
  const direct = Date.parse(timeStr)
  if (!isNaN(direct)) return new Date(direct)

  // Try relative day parsing: "Tuesday 2pm", "next Monday at 10:00 AM", etc.
  const lower = timeStr.toLowerCase().trim()
  const dayNames = [
    "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
  ]

  let targetDay = -1
  for (let i = 0; i < dayNames.length; i++) {
    if (lower.includes(dayNames[i])) {
      targetDay = i
      break
    }
  }

  if (targetDay === -1) return null

  // Extract time portion
  const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/)
  if (!timeMatch) return null

  let hours = parseInt(timeMatch[1])
  const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0
  const ampm = timeMatch[3]
  if (ampm === "pm" && hours < 12) hours += 12
  if (ampm === "am" && hours === 12) hours = 0

  // Find next occurrence of targetDay from referenceDate
  const result = new Date(referenceDate)
  const currentDay = result.getDay()
  let daysUntil = targetDay - currentDay
  if (daysUntil <= 0) daysUntil += 7

  result.setDate(result.getDate() + daysUntil)
  result.setHours(hours, minutes, 0, 0)
  return result
}

export function analyzeAvailability(
  events: CalendarEvent[],
  proposedTimes: string[],
  rangeStart: Date,
  rangeEnd: Date
): AvailabilityResult {
  // Parse events into intervals
  const busyIntervals: { start: Date; end: Date; summary: string }[] = []
  const eventSummaries: AvailabilityResult["events"] = []

  for (const ev of events) {
    const startStr = ev.start.dateTime || ev.start.date
    const endStr = ev.end.dateTime || ev.end.date
    if (!startStr || !endStr) continue

    const start = new Date(startStr)
    const end = new Date(endStr)
    busyIntervals.push({ start, end, summary: ev.summary || "Busy" })

    eventSummaries.push({
      summary: ev.summary || "Busy",
      start: startStr,
      label: formatSlotLabel(start, end),
    })
  }

  busyIntervals.sort((a, b) => a.start.getTime() - b.start.getTime())

  // Check proposed times against busy intervals
  const proposedTimeStatus: ProposedTimeStatus[] = proposedTimes.map((pt) => {
    const parsed = parseProposedTime(pt, rangeStart)
    if (!parsed) return { label: pt, available: null }

    const hasConflict = busyIntervals.some(
      (b) => parsed >= b.start && parsed < b.end
    )
    return { label: pt, available: !hasConflict }
  })

  // Find free 1-hour slots within working hours (9 AM - 6 PM)
  const suggestedSlots: SlotInfo[] = []
  const WORK_START_HOUR = 9
  const WORK_END_HOUR = 18
  const SLOT_DURATION_MS = 60 * 60 * 1000

  const cursor = new Date(rangeStart)
  // Advance to next working hour if needed
  if (cursor.getHours() < WORK_START_HOUR) {
    cursor.setHours(WORK_START_HOUR, 0, 0, 0)
  } else if (cursor.getHours() >= WORK_END_HOUR) {
    cursor.setDate(cursor.getDate() + 1)
    cursor.setHours(WORK_START_HOUR, 0, 0, 0)
  }

  while (suggestedSlots.length < 3 && cursor.getTime() < rangeEnd.getTime()) {
    const slotEnd = new Date(cursor.getTime() + SLOT_DURATION_MS)

    // Check if within working hours
    if (cursor.getHours() >= WORK_START_HOUR && slotEnd.getHours() <= WORK_END_HOUR) {
      const hasConflict = busyIntervals.some(
        (b) => cursor < b.end && slotEnd > b.start
      )
      if (!hasConflict) {
        suggestedSlots.push({
          label: formatSlotLabel(cursor, slotEnd),
          start: cursor.toISOString(),
          end: slotEnd.toISOString(),
        })
      }
    }

    // Advance cursor
    cursor.setTime(cursor.getTime() + SLOT_DURATION_MS)

    // Jump to next working day if past work hours
    if (cursor.getHours() >= WORK_END_HOUR) {
      cursor.setDate(cursor.getDate() + 1)
      cursor.setHours(WORK_START_HOUR, 0, 0, 0)
    }
  }

  return { events: eventSummaries, proposedTimeStatus, suggestedSlots }
}

function formatSlotLabel(start: Date, end: Date): string {
  const dateStr = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
  const startTime = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
  const endTime = end.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
  return `${dateStr}, ${startTime} – ${endTime}`
}

// ── Mutations/queries for pendingCalendarSlots ──

export const upsertCalendarSlots = internalMutation({
  args: {
    applicationId: v.id("applications"),
    telegramChatId: v.string(),
    slots: v.array(
      v.object({ label: v.string(), start: v.string(), end: v.string() })
    ),
    proposedTimeStatus: v.array(
      v.object({
        label: v.string(),
        available: v.union(v.boolean(), v.null()),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Delete existing record for this app+chat combo
    const existing = await ctx.db
      .query("pendingCalendarSlots")
      .withIndex("by_applicationId_and_telegramChatId", (q) =>
        q.eq("applicationId", args.applicationId).eq("telegramChatId", args.telegramChatId)
      )
      .unique()
    if (existing) {
      await ctx.db.delete(existing._id)
    }
    return await ctx.db.insert("pendingCalendarSlots", {
      applicationId: args.applicationId,
      telegramChatId: args.telegramChatId,
      slots: args.slots,
      proposedTimeStatus: args.proposedTimeStatus,
      createdAt: Date.now(),
    })
  },
})

export const getCalendarSlots = internalQuery({
  args: {
    applicationId: v.id("applications"),
    telegramChatId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pendingCalendarSlots")
      .withIndex("by_applicationId_and_telegramChatId", (q) =>
        q.eq("applicationId", args.applicationId).eq("telegramChatId", args.telegramChatId)
      )
      .unique()
  },
})

export const deleteCalendarSlots = internalMutation({
  args: { id: v.id("pendingCalendarSlots") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id)
  },
})

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
