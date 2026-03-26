"use client"

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Mail, Eye, Clock, Activity, Sparkles } from "lucide-react"

const statusColors: Record<string, string> = {
  Applied: "border border-blue-200 bg-blue-50 text-blue-700",
  Replied: "border border-indigo-200 bg-indigo-50 text-indigo-700",
  Interview: "border border-amber-200 bg-amber-50 text-amber-700",
  Offer: "border border-emerald-200 bg-emerald-50 text-emerald-700",
  Rejected: "border border-red-200 bg-red-50 text-red-600",
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatDateTime(ts: number) {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatRelativeTime(ts: number) {
  const seconds = Math.floor((Date.now() - ts) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function getEngagementLabel(opens: number) {
  if (opens === 0) return "Cold"
  if (opens <= 2) return "Warming"
  if (opens <= 4) return "Active"
  return "Hot"
}

const nextActionCopy: Record<string, string> = {
  Applied:
    "If this stays quiet for 5-7 days, send one short follow-up with a clear CTA.",
  Replied:
    "Reply quickly while intent is high and include 2-3 scheduling windows if they asked to connect.",
  Interview:
    "Prepare role-specific stories and send a same-day thank-you note after the interview.",
  Offer:
    "Confirm compensation details, timeline, and next paperwork before you accept.",
  Rejected:
    "Close the loop politely and keep this contact warm for future openings.",
}

export default function TrackerPage() {
  const params = useParams()
  const idParam = params.id
  const id =
    typeof idParam === "string"
      ? (idParam as Id<"applications">)
      : Array.isArray(idParam)
        ? (idParam[0] as Id<"applications">)
        : undefined

  const application = useQuery(api.applications.getById, id ? { id } : "skip")
  const opens = useQuery(
    api.applications.getOpens,
    id ? { applicationId: id } : "skip"
  )

  if (!id || application === undefined || opens === undefined) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_10%_0%,#f1f7e4_0%,#f8f8f6_45%,#f2f1ee_100%)]">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <div className="mb-8 h-4 w-40 animate-pulse rounded bg-gray-200" />
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-black/10 bg-white p-6">
              <div className="h-6 w-24 animate-pulse rounded bg-gray-100" />
              <div className="mt-4 h-8 w-48 animate-pulse rounded bg-gray-100" />
              <div className="mt-3 h-4 w-56 animate-pulse rounded bg-gray-100" />
            </div>
            <div className="space-y-6">
              <div className="rounded-3xl border border-black/10 bg-white p-6">
                <div className="h-6 w-16 animate-pulse rounded bg-gray-100" />
                <div className="mt-4 h-10 w-20 animate-pulse rounded bg-gray-100" />
              </div>
              <div className="rounded-3xl border border-black/10 bg-white p-6">
                <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
                <div className="mt-3 h-4 w-5/6 animate-pulse rounded bg-gray-100" />
              </div>
            </div>
          </div>
          <div className="mt-6 rounded-3xl border border-black/10 bg-white p-6">
            <div className="h-6 w-32 animate-pulse rounded bg-gray-100" />
            <div className="mt-4 space-y-3">
              <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-4/5 animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (application === null) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <p className="text-gray-500">Application not found.</p>
        <Link
          href="/dashboard"
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
      </div>
    )
  }

  const openCount = Math.max(application.openCount ?? 0, opens.length)
  const firstOpen = opens.length > 0 ? opens[opens.length - 1] : null
  const latestOpen = opens.length > 0 ? opens[0] : null
  const engagementLabel = getEngagementLabel(openCount)

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_0%,#f1f7e4_0%,#f8f8f6_45%,#f2f1ee_100%)]">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Link
          href="/dashboard"
          className="group mb-8 inline-flex items-center gap-2 text-sm font-semibold text-black/60 transition-colors hover:text-black"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to Dashboard
        </Link>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="relative overflow-hidden rounded-3xl border border-black/10 bg-white p-6 sm:p-8">
            <div className="pointer-events-none absolute top-0 right-0 h-28 w-28 rounded-full bg-[#b8ff66]/40 blur-2xl" />
            <div className="relative">
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusColors[application.status] ?? "border border-gray-200 bg-gray-50 text-gray-600"}`}
              >
                {application.status}
              </span>
              <h1 className="mt-4 font-display text-3xl leading-tight font-semibold text-primary sm:text-4xl">
                {application.company}
              </h1>
              <p className="mt-1 text-base text-black/70">{application.role}</p>

              <div className="mt-6 grid gap-3 text-xs text-black/60 sm:grid-cols-2">
                <div className="flex items-center gap-2 rounded-xl border border-black/10 bg-[#f8f8f8] px-3 py-2.5">
                  <Mail className="h-3.5 w-3.5" />
                  <span className="truncate">{application.recipientEmail}</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-black/10 bg-[#f8f8f8] px-3 py-2.5">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    Sent{" "}
                    {formatDate(
                      application.emailSentAt ?? application.createdAt
                    )}
                  </span>
                </div>
              </div>
            </div>
          </article>

          <div className="space-y-6">
            <article className="rounded-3xl border border-black/10 bg-[#151515] p-6 text-white">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.1em] text-white/70 uppercase">
                <Activity className="h-3.5 w-3.5" />
                Engagement
              </div>
              <div className="mt-3 flex items-end justify-between">
                <p className="text-5xl leading-none font-semibold">
                  {openCount}
                </p>
                <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-semibold uppercase">
                  {engagementLabel}
                </span>
              </div>
              <p className="mt-2 text-sm text-white/70">
                {openCount === 1 ? "open recorded" : "opens recorded"}
              </p>
            </article>

            <article className="rounded-3xl border border-black/10 bg-white p-6">
              <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#b8ff66] text-black">
                <Sparkles className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-semibold tracking-[0.08em] text-black/65 uppercase">
                Next move
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-black/70">
                {nextActionCopy[application.status] ??
                  "Keep this thread active with a short, specific follow-up if momentum stalls."}
              </p>
            </article>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-3xl border border-black/10 bg-white">
            <div className="border-b border-black/10 px-6 py-4">
              <h2 className="text-sm font-bold tracking-[0.08em] text-black/70 uppercase">
                Open History
              </h2>
            </div>
            {opens.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-black/50 italic">
                  No opens recorded yet. This timeline updates automatically
                  when the recipient opens your email.
                </p>
              </div>
            ) : (
              <div className="space-y-0 px-6 py-4">
                {opens.map((open, index) => (
                  <div
                    key={open._id}
                    className="relative grid grid-cols-[24px_1fr] gap-3 py-3"
                  >
                    <div className="relative flex justify-center">
                      <span className="z-10 mt-1 h-2.5 w-2.5 rounded-full bg-black" />
                      {index < opens.length - 1 && (
                        <span className="absolute top-4 h-full w-px bg-black/15" />
                      )}
                    </div>
                    <div className="rounded-xl border border-black/10 bg-[#f8f8f8] px-3 py-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-black/80">
                          {index === 0
                            ? "Latest open"
                            : index === opens.length - 1
                              ? "First open"
                              : `Open #${opens.length - index}`}
                        </p>
                        <span className="text-xs text-black/50">
                          {formatRelativeTime(open.openedAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-black/65">
                        {formatDateTime(open.openedAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="rounded-3xl border border-black/10 bg-white p-6">
            <h2 className="text-sm font-bold tracking-[0.08em] text-black/70 uppercase">
              Timeline Summary
            </h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-black/10 bg-[#f8f8f8] px-4 py-3">
                <p className="text-xs font-semibold text-black/55 uppercase">
                  Sent
                </p>
                <p className="mt-1 text-sm font-medium text-black/80">
                  {formatDateTime(
                    application.emailSentAt ?? application.createdAt
                  )}
                </p>
              </div>
              <div className="rounded-2xl border border-black/10 bg-[#f8f8f8] px-4 py-3">
                <p className="text-xs font-semibold text-black/55 uppercase">
                  First open
                </p>
                <p className="mt-1 text-sm font-medium text-black/80">
                  {firstOpen
                    ? formatDateTime(firstOpen.openedAt)
                    : "Not opened yet"}
                </p>
              </div>
              <div className="rounded-2xl border border-black/10 bg-[#f8f8f8] px-4 py-3">
                <p className="text-xs font-semibold text-black/55 uppercase">
                  Latest open
                </p>
                <p className="mt-1 text-sm font-medium text-black/80">
                  {latestOpen
                    ? formatDateTime(latestOpen.openedAt)
                    : "Not opened yet"}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-black/10 bg-[#151515] px-4 py-3 text-sm text-white/75">
              <div className="mb-1 flex items-center gap-2">
                <Eye className="h-4 w-4 text-[#b8ff66]" />
                <span className="font-semibold text-white">
                  Tracking health
                </span>
              </div>
              Pixel events are being recorded and attached to this application
              timeline in real time.
            </div>
          </article>
        </section>
      </div>
    </div>
  )
}
