"use client"

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, Mail, Eye, Clock } from "lucide-react"

const statusColors: Record<string, string> = {
  Applied: "bg-blue-50 text-blue-700 border border-blue-200",
  Replied: "bg-purple-50 text-purple-700 border border-purple-200",
  Interview: "bg-amber-50 text-amber-700 border border-amber-200",
  Offer: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Rejected: "bg-red-50 text-red-600 border border-red-200",
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

function timeAgo(ts: number) {
  const seconds = Math.floor((Date.now() - ts) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function TrackerPage() {
  const params = useParams()
  const id = params.id as Id<"applications">

  const application = useQuery(api.applications.getById, { id })
  const opens = useQuery(api.applications.getOpens, { applicationId: id })

  if (application === undefined || opens === undefined) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="mb-8 h-4 w-36 animate-pulse rounded bg-gray-100" />
        <div className="mb-6 animate-pulse space-y-3 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="h-5 w-32 rounded bg-gray-100" />
              <div className="h-3 w-48 rounded bg-gray-50" />
            </div>
            <div className="h-6 w-16 rounded-full bg-gray-100" />
          </div>
          <div className="flex gap-4 pt-2">
            <div className="h-3 w-40 rounded bg-gray-50" />
            <div className="h-3 w-28 rounded bg-gray-50" />
          </div>
        </div>
        <div className="mb-6 animate-pulse rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-gray-100" />
            <div className="space-y-2">
              <div className="h-6 w-10 rounded bg-gray-100" />
              <div className="h-3 w-20 rounded bg-gray-50" />
            </div>
          </div>
        </div>
        <div className="animate-pulse rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-50 px-6 py-4">
            <div className="h-4 w-24 rounded bg-gray-100" />
          </div>
          <div className="space-y-3 p-6">
            <div className="h-3 w-full rounded bg-gray-50" />
            <div className="h-3 w-3/4 rounded bg-gray-50" />
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

  const openCount = application.openCount ?? 0

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <Link
        href="/dashboard"
        className="group mb-8 inline-flex items-center gap-2 text-sm font-semibold text-gray-500 transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
        Back to Dashboard
      </Link>

      {/* Application Details */}
      <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="font-display text-xl font-bold text-primary">
              {application.company}
            </h1>
            <p className="text-sm text-gray-500">{application.role}</p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusColors[application.status] ?? "bg-gray-50 text-gray-600"}`}
          >
            {application.status}
          </span>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Mail className="h-3.5 w-3.5" />
            {application.recipientEmail}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            Sent {formatDate(application.emailSentAt ?? application.createdAt)}
          </span>
        </div>
      </div>

      {/* Open Tracking Stats */}
      <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
            <Eye className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">{openCount}</p>
            <p className="text-xs text-gray-400">
              {openCount === 1 ? "time opened" : "times opened"}
            </p>
          </div>
        </div>
      </div>

      {/* Open Events Timeline */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-50 px-6 py-4">
          <h2 className="text-sm font-bold text-primary">Open History</h2>
        </div>
        {opens.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm italic text-gray-400">
              No opens recorded yet. The tracker will update when the recipient
              opens your email.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {opens.map((open) => (
              <div
                key={open._id}
                className="flex items-center justify-between px-6 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-blue-400" />
                  <span className="text-sm text-gray-600">
                    {formatDateTime(open.openedAt)}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {timeAgo(open.openedAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
