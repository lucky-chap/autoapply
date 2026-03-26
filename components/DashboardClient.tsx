"use client"

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useState } from "react"
import {
  Loader2,
  Inbox,
  Eye,
  Mail,
  Building2,
  Calendar,
  Sparkles,
  CalendarCheck,
  MessageSquareReply,
  Send,
  TrendingUp,
} from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

const statusStyles: Record<string, string> = {
  Applied: "border-blue-200 bg-blue-50 text-blue-700",
  Replied: "border-indigo-200 bg-indigo-50 text-indigo-700",
  Interview: "border-amber-200 bg-amber-50 text-amber-700",
  Offer: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Rejected: "border-red-200 bg-red-50 text-red-600",
}

const repliedStatuses = new Set(["Replied", "Interview", "Offer", "Rejected"])
const interviewStatuses = new Set(["Interview", "Offer"])

type DashboardApplication = {
  _id: string
  status: string
  createdAt: number
  emailSentAt?: number
  openCount?: number
}

type DashboardMetrics = {
  totalSent: number
  replyCount: number
  interviewCount: number
  successRate: number
  weekSent: number
  weekReplies: number
  sendTarget: number
  replyTarget: number
  sendProgress: number
  replyProgress: number
  bestSendDay: string
  totalOpens: number
}

function getWeekStartEpoch() {
  const now = new Date()
  const weekStart = new Date(now)
  const mondayOffset = (now.getDay() + 6) % 7
  weekStart.setDate(now.getDate() - mondayOffset)
  weekStart.setHours(0, 0, 0, 0)
  return weekStart.getTime()
}

function getBestSendDay(applications: DashboardApplication[]) {
  const weekdays = [
    { label: "Sunday", sent: 0, replied: 0 },
    { label: "Monday", sent: 0, replied: 0 },
    { label: "Tuesday", sent: 0, replied: 0 },
    { label: "Wednesday", sent: 0, replied: 0 },
    { label: "Thursday", sent: 0, replied: 0 },
    { label: "Friday", sent: 0, replied: 0 },
    { label: "Saturday", sent: 0, replied: 0 },
  ]

  for (const application of applications) {
    const sentAt = application.emailSentAt ?? application.createdAt
    const weekday = new Date(sentAt).getDay()
    weekdays[weekday].sent += 1
    if (repliedStatuses.has(application.status)) {
      weekdays[weekday].replied += 1
    }
  }

  let winner: (typeof weekdays)[number] | null = null
  let winnerScore = -1

  for (const day of weekdays) {
    if (day.sent === 0) continue
    const score = day.replied / day.sent
    if (
      score > winnerScore ||
      (score === winnerScore && day.sent > (winner?.sent ?? 0))
    ) {
      winner = day
      winnerScore = score
    }
  }

  if (winner) return winner.label

  const mostUsedDay = weekdays.reduce(
    (best, day) => (day.sent > best.sent ? day : best),
    weekdays[4]
  )
  return mostUsedDay.label
}

function getDashboardMetrics(
  applications: DashboardApplication[]
): DashboardMetrics {
  const totalSent = applications.length
  const replyCount = applications.filter((app) =>
    repliedStatuses.has(app.status)
  ).length
  const interviewCount = applications.filter((app) =>
    interviewStatuses.has(app.status)
  ).length
  const successRate =
    totalSent === 0 ? 0 : Math.round((replyCount / totalSent) * 100)
  const totalOpens = applications.reduce(
    (sum, app) => sum + (app.openCount ?? 0),
    0
  )

  const weekStartEpoch = getWeekStartEpoch()
  const weekSent = applications.filter(
    (app) => (app.emailSentAt ?? app.createdAt) >= weekStartEpoch
  ).length
  const weekReplies = applications.filter(
    (app) =>
      repliedStatuses.has(app.status) &&
      (app.emailSentAt ?? app.createdAt) >= weekStartEpoch
  ).length

  const sendTarget = Math.max(10, Math.ceil((weekSent + 2) / 5) * 5)
  const replyTarget = Math.max(4, Math.ceil((weekReplies + 1) / 2) * 2)
  const sendProgress = Math.min(100, Math.round((weekSent / sendTarget) * 100))
  const replyProgress = Math.min(
    100,
    Math.round((weekReplies / replyTarget) * 100)
  )
  const bestSendDay = getBestSendDay(applications)

  return {
    totalSent,
    replyCount,
    interviewCount,
    successRate,
    weekSent,
    weekReplies,
    sendTarget,
    replyTarget,
    sendProgress,
    replyProgress,
    bestSendDay,
    totalOpens,
  }
}

export function DashboardWeeklyFocus({ userId }: { userId: string }) {
  const applications = useQuery(api.applications.getByUser, { userId })

  if (applications === undefined) {
    return (
      <div className="rounded-3xl border border-black/15 bg-white p-6">
        <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <div className="h-3 w-32 animate-pulse rounded bg-gray-100" />
            <div className="h-2 animate-pulse rounded-full bg-gray-100" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-28 animate-pulse rounded bg-gray-100" />
            <div className="h-2 animate-pulse rounded-full bg-gray-100" />
          </div>
        </div>
      </div>
    )
  }

  const metrics = getDashboardMetrics(applications)
  const focusCopy =
    metrics.totalSent === 0
      ? "No applications yet. Send one today to unlock your trend data."
      : metrics.successRate >= 35
        ? "Reply momentum is strong. Keep the same cadence this week."
        : "Try tightening your opener around two exact job requirements."

  return (
    <div className="rounded-3xl border border-black/15 bg-white p-6">
      <p className="text-xs font-semibold tracking-[0.1em] text-black/60 uppercase">
        Weekly focus
      </p>
      <div className="mt-4 space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase">
            <span>Send target</span>
            <span>
              {metrics.weekSent} / {metrics.sendTarget}
            </span>
          </div>
          <div className="h-2 rounded-full bg-black/15">
            <div
              className="h-2 rounded-full bg-[#b8ff66] transition-all duration-500"
              style={{ width: `${metrics.sendProgress}%` }}
            />
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase">
            <span>Reply target</span>
            <span>
              {metrics.weekReplies} / {metrics.replyTarget}
            </span>
          </div>
          <div className="h-2 rounded-full bg-black/15">
            <div
              className="h-2 rounded-full bg-black transition-all duration-500"
              style={{ width: `${metrics.replyProgress}%` }}
            />
          </div>
        </div>
        <div className="rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-black/70">
          Best day to send based on your data: <b>{metrics.bestSendDay}</b>
        </div>
        <div className="rounded-xl border border-black/10 bg-[#f7f7f7] px-4 py-3 text-sm text-black/70">
          {focusCopy}
        </div>
      </div>
    </div>
  )
}

export function DashboardStatCards({ userId }: { userId: string }) {
  const applications = useQuery(api.applications.getByUser, { userId })

  if (applications === undefined) {
    return (
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <article
            key={idx}
            className={`rounded-2xl border p-5 ${
              idx % 2 === 1
                ? "border-black/15 bg-[#161616] text-white"
                : "border-black/15 bg-white text-black"
            }`}
          >
            <div className="h-5 w-5 animate-pulse rounded bg-black/20" />
            <div className="mt-4 h-8 w-14 animate-pulse rounded bg-black/15" />
            <div className="mt-2 h-3 w-28 animate-pulse rounded bg-black/15" />
          </article>
        ))}
      </div>
    )
  }

  const metrics = getDashboardMetrics(applications)
  const cards = [
    {
      icon: Send,
      label: "Applications Sent",
      value: String(metrics.totalSent),
      helper: `${metrics.weekSent} this week`,
    },
    {
      icon: MessageSquareReply,
      label: "Replies Received",
      value: String(metrics.replyCount),
      helper: `${metrics.totalOpens} tracked opens`,
    },
    {
      icon: CalendarCheck,
      label: "Interviews",
      value: String(metrics.interviewCount),
      helper: "Interview or offer stage",
    },
    {
      icon: TrendingUp,
      label: "Success Rate",
      value: `${metrics.successRate}%`,
      helper: "Replies over sends",
    },
  ]

  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, idx) => (
        <article
          key={card.label}
          className={`rounded-2xl border p-5 ${
            idx % 2 === 1
              ? "border-black/15 bg-[#161616] text-white"
              : "border-black/15 bg-white text-black"
          }`}
        >
          <card.icon className="h-5 w-5" />
          <p className="mt-4 text-3xl leading-none font-semibold">
            {card.value}
          </p>
          <p
            className={`mt-2 text-xs font-semibold tracking-[0.1em] uppercase ${
              idx % 2 === 1 ? "text-white/70" : "text-black/60"
            }`}
          >
            {card.label}
          </p>
          <p
            className={`mt-2 text-xs ${idx % 2 === 1 ? "text-white/60" : "text-black/50"}`}
          >
            {card.helper}
          </p>
        </article>
      ))}
    </div>
  )
}

export function ApplicationsTable({ userId }: { userId: string }) {
  const applications = useQuery(api.applications.getByUser, { userId })
  const router = useRouter()

  if (applications === undefined) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex animate-pulse items-center gap-4">
            <div className="h-8 w-8 rounded-lg bg-gray-100" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded bg-gray-100" />
              <div className="h-3 w-48 rounded bg-gray-50" />
            </div>
            <div className="hidden h-3 w-24 rounded bg-gray-50 sm:block" />
            <div className="h-6 w-16 rounded-full bg-gray-100" />
            <div className="h-4 w-8 rounded bg-gray-50" />
            <div className="hidden h-3 w-20 rounded bg-gray-50 sm:block" />
          </div>
        ))}
      </div>
    )
  }

  if (applications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white">
          <Mail className="h-8 w-8 text-gray-300" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-primary">No applications yet</p>
          <p className="mt-1 max-w-xs text-sm text-gray-500">
            Paste a job description and let the AI craft a personalised cover
            letter for you.
          </p>
        </div>
        <Link
          href="/dashboard/new"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 active:scale-95"
        >
          <Sparkles className="h-4 w-4" />
          Send your first application
        </Link>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="text-[11px] tracking-[0.1em] text-black/45 uppercase">
            Company
          </TableHead>
          <TableHead className="hidden text-[11px] tracking-[0.1em] text-black/45 uppercase sm:table-cell">
            Recipient
          </TableHead>
          <TableHead className="text-[11px] tracking-[0.1em] text-black/45 uppercase">
            Status
          </TableHead>
          <TableHead className="text-center text-[11px] tracking-[0.1em] text-black/45 uppercase">
            Opens
          </TableHead>
          <TableHead className="hidden text-[11px] tracking-[0.1em] text-black/45 uppercase sm:table-cell">
            Sent
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {applications.map((app) => (
          <TableRow
            key={app._id}
            className="cursor-pointer hover:bg-white"
            onClick={() => router.push(`/dashboard/tracker/${app._id}`)}
          >
            <TableCell>
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50">
                  <Building2 className="h-4 w-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-primary">
                    {app.company}
                  </p>
                  <p className="text-[11px] text-gray-500">{app.role}</p>
                </div>
              </div>
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              <span className="flex items-center gap-1.5 text-gray-500">
                <Mail className="h-3.5 w-3.5 text-gray-300" />
                {app.recipientEmail}
              </span>
            </TableCell>
            <TableCell>
              <Badge
                className={`${statusStyles[app.status] ?? "border-gray-200 bg-gray-50 text-gray-600"} border font-semibold`}
              >
                {app.status}
              </Badge>
            </TableCell>
            <TableCell className="text-center">
              {(app.openCount ?? 0) > 0 ? (
                <span className="inline-flex items-center gap-1 text-blue-600">
                  <Eye className="h-3.5 w-3.5" />
                  <span className="text-sm font-semibold">{app.openCount}</span>
                </span>
              ) : (
                <span className="text-gray-300">&mdash;</span>
              )}
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              <span className="flex items-center gap-1.5 text-gray-400">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(app.emailSentAt ?? app.createdAt).toLocaleDateString(
                  "en-US",
                  {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  }
                )}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function CheckInboxButton() {
  const [isChecking, setIsChecking] = useState(false)
  const [result, setResult] = useState<{
    message: string
    isError: boolean
  } | null>(null)

  const handleCheck = async () => {
    setIsChecking(true)
    setResult(null)
    try {
      const res = await fetch("/api/check-inbox", { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        setResult({
          message: data.error || "Failed to check inbox.",
          isError: true,
        })
      } else if (data.updated > 0) {
        setResult({
          message: `Updated ${data.updated} application(s)!`,
          isError: false,
        })
      } else {
        setResult({ message: "No new replies found.", isError: false })
      }
    } catch {
      setResult({
        message: "Network error — check your connection.",
        isError: true,
      })
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleCheck}
        disabled={isChecking}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-4 py-3 text-sm font-bold text-primary transition-all hover:bg-white disabled:opacity-50"
      >
        {isChecking ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking inbox...
          </>
        ) : (
          <>
            <Inbox className="h-4 w-4" />
            Check for Replies
          </>
        )}
      </button>
      {result && (
        <p
          className={`mt-2 text-center text-xs ${result.isError ? "text-red-500" : "text-gray-500"}`}
        >
          {result.message}
        </p>
      )}
    </div>
  )
}
