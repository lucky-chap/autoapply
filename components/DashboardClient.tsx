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
  MousePointerClick,
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
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"

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
  clickCount?: number
  company: string
  role: string
  recipientEmail: string
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
  totalClicks: number
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
  const totalClicks = applications.reduce(
    (sum, app) => sum + (app.clickCount ?? 0),
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
    totalClicks,
  }
}

export function DashboardWeeklyFocus({ userId }: { userId: string }) {
  const applications = useQuery(api.applications.getByUser, { userId })

  if (applications === undefined) {
    return (
      <div className="rounded-2xl border border-black/5 bg-white p-6">
        <Skeleton className="h-4 w-24" />
        <div className="mt-6 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-10" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-10" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        </div>
      </div>
    )
  }

  const metrics = getDashboardMetrics(applications as DashboardApplication[])
  const focusCopy =
    metrics.totalSent === 0
      ? "No applications yet. Send one today to unlock your trend data."
      : metrics.successRate >= 35
        ? "Reply momentum is strong. Keep the same cadence this week."
        : "Try tightening your opener around two exact job requirements."

  return (
    <div className="p-6 py-0">
      <p className="text-[10px] font-bold tracking-[0.2em] text-black/40 uppercase">
        Targets
      </p>
      <div className="mt-6 space-y-6">
        <div>
          <div className="mb-2.5 flex items-center justify-between text-[11px] font-bold tracking-tight text-black/60 uppercase">
            <span>Send target</span>
            <span className="text-black">
              {metrics.weekSent} / {metrics.sendTarget}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-black/5">
            <div
              className="h-full bg-[#b8ff66] transition-all duration-700 ease-out"
              style={{ width: `${metrics.sendProgress}%` }}
            />
          </div>
        </div>
        <div>
          <div className="mb-2.5 flex items-center justify-between text-[11px] font-bold tracking-tight text-black/60 uppercase">
            <span>Reply target</span>
            <span className="text-black">
              {metrics.weekReplies} / {metrics.replyTarget}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-black/5">
            <div
              className="h-full bg-black transition-all duration-700 ease-out"
              style={{ width: `${metrics.replyProgress}%` }}
            />
          </div>
        </div>
        <div className="space-y-2 pt-2">
          <div className="flex items-center gap-3 rounded-xl border border-black/5 bg-[#fafafa] px-4 py-3 text-xs text-black/60">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>
              Best day to send:{" "}
              <b className="text-black">{metrics.bestSendDay}</b>
            </span>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-black/5 bg-black/2 px-4 py-3 text-xs leading-relaxed text-black/60">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{focusCopy}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function DashboardStatCards({ userId }: { userId: string }) {
  const applications = useQuery(api.applications.getByUser, { userId })

  if (applications === undefined) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="space-y-4 rounded-xl border border-black/5 bg-[#fafafa] p-5"
          >
            <Skeleton className="h-5 w-5 rounded-md" />
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    )
  }

  const metrics = getDashboardMetrics(applications as DashboardApplication[])
  const cards = [
    {
      icon: Send,
      label: "Sent",
      value: String(metrics.totalSent),
      helper: `${metrics.weekSent} this week`,
    },
    {
      icon: MessageSquareReply,
      label: "Replies",
      value: String(metrics.replyCount),
      helper: `${metrics.totalClicks} clicks · ${metrics.totalOpens} opens`,
    },
    {
      icon: CalendarCheck,
      label: "Interviews",
      value: String(metrics.interviewCount),
      helper: "Interview or offer stage",
    },
    {
      icon: TrendingUp,
      label: "Rate",
      value: `${metrics.successRate}%`,
      helper: "Replies over sends",
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <article
          key={card.label}
          className="rounded-xl border border-black/5 bg-[#fafafa] p-5 text-black transition-colors hover:bg-black/1"
        >
          <div className="flex items-center justify-between">
            <card.icon className="h-4 w-4 text-black/40" />
            <span className="text-[10px] font-bold tracking-widest text-black/30 uppercase">
              {card.label}
            </span>
          </div>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-black">
            {card.value}
          </p>
          <p className="mt-1 truncate text-[11px] font-medium text-black/40">
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
      <div className="space-y-4 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="hidden h-3 w-24 sm:block" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    )
  }

  if (applications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/5">
          <Mail className="h-8 w-8 text-black/20" />
        </div>
        <div>
          <p className="font-semibold text-black">No applications yet</p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-black/40">
            Paste a job description and a recipient email to get started. AI
            will draft a personalized cover letter for you.
          </p>
        </div>
        <Link
          href="/dashboard/new"
          className="inline-flex items-center gap-2 rounded-full bg-black px-6 py-2.5 text-xs font-bold tracking-widest text-white uppercase transition-colors hover:bg-black/90"
        >
          <Sparkles className="h-4 w-4" />
          Start First App
        </Link>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-b border-black/5 hover:bg-transparent">
          <TableHead className="pl-5">Company</TableHead>
          <TableHead className="hidden sm:table-cell">Recipient</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-center">Engagement</TableHead>
          <TableHead className="hidden pr-5 text-right sm:table-cell">
            Sent
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {applications.map((app) => (
          <TableRow
            key={app._id}
            className="group cursor-pointer transition-colors hover:bg-black/2"
            onClick={() => router.push(`/dashboard/tracker/${app._id}`)}
          >
            <TableCell className="py-4 pl-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black/5 text-black/40 transition-colors group-hover:bg-black/10 group-hover:text-black">
                  <Building2 className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm leading-tight font-semibold text-black">
                    {app.company}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-black/40">
                    {app.role}
                  </p>
                </div>
              </div>
            </TableCell>
            <TableCell className="hidden py-4 sm:table-cell">
              <span className="flex items-center gap-2 text-xs text-black/50">
                <Mail className="h-3.5 w-3.5 shrink-0 opacity-40" />
                <span className="max-w-[140px] truncate">
                  {app.recipientEmail}
                </span>
              </span>
            </TableCell>
            <TableCell className="py-4">
              <Badge
                className={`${statusStyles[app.status] ?? "border-gray-200 bg-gray-50 text-gray-600"} h-5 border-0 px-2 py-0 text-[10px] font-bold tracking-tight uppercase shadow-none`}
              >
                {app.status}
              </Badge>
            </TableCell>
            <TableCell className="py-4 text-center">
              <div className="inline-flex items-center gap-3">
                {(app.clickCount ?? 0) > 0 ? (
                  <span
                    className="inline-flex items-center gap-1 text-emerald-600"
                    title="Link clicks"
                  >
                    <MousePointerClick className="h-3.5 w-3.5" />
                    <span className="text-xs font-bold">{app.clickCount}</span>
                  </span>
                ) : null}
                {(app.openCount ?? 0) > 0 ? (
                  <span
                    className="inline-flex items-center gap-1 text-blue-600"
                    title="Email opens"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span className="text-xs font-bold">{app.openCount}</span>
                  </span>
                ) : null}
                {(app.clickCount ?? 0) === 0 && (app.openCount ?? 0) === 0 ? (
                  <span className="text-black/10 transition-colors group-hover:text-black/30">
                    &mdash;
                  </span>
                ) : null}
              </div>
            </TableCell>
            <TableCell className="hidden py-4 pr-5 text-right sm:table-cell">
              <span className="flex items-center justify-end gap-1.5 text-xs text-black/40">
                <Calendar className="h-3 w-3 opacity-60" />
                {new Date(app.emailSentAt ?? app.createdAt).toLocaleDateString(
                  "en-US",
                  {
                    month: "short",
                    day: "numeric",
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
      <Button
        onClick={handleCheck}
        disabled={isChecking}
        variant="outline"
        className="h-12 w-full rounded-full border-black/10 bg-white text-xs font-bold tracking-widest text-black uppercase transition-all hover:bg-black/5"
      >
        {isChecking ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Checking...
          </>
        ) : (
          <>
            <Inbox className="mr-2 h-4 w-4" />
            Check Inbox
          </>
        )}
      </Button>
      {result && (
        <p
          className={`mt-3 text-center text-[10px] font-bold tracking-tight uppercase ${result.isError ? "text-red-500" : "text-black/40"}`}
        >
          {result.message}
        </p>
      )}
    </div>
  )
}
