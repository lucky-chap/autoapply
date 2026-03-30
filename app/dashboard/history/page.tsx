"use client"

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import Link from "next/link"
import { Zap, ArrowLeft, Clock } from "lucide-react"

const statusColors: Record<string, string> = {
  gathering: "bg-neutral-100 text-neutral-700",
  drafting: "bg-neutral-100 text-neutral-700",
  ready: "bg-black text-white",
  distributed: "bg-black text-white",
}

type SessionItem = {
  _id: Id<"standupSessions">
  date: string
  status: string
  createdAt: number
  generatedContent?: string
}

export default function HistoryPage() {
  const sessions = useQuery(api.standupSessions.getRecent, { limit: 20 })
  const recentSessions = (sessions ?? []) as SessionItem[]

  return (
    <div className="relative min-h-screen bg-neutral-100 text-neutral-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-28 right-0 h-72 w-72 rounded-full bg-white blur-3xl" />
      </div>

      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4">
          <Link
            href="/dashboard"
            className="grid h-8 w-8 place-items-center rounded-full border border-neutral-300 text-neutral-500 transition-colors hover:border-neutral-400 hover:text-neutral-900"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-black text-white">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <p className="font-display text-sm font-semibold text-neutral-900">Standup History</p>
              <p className="text-xs text-neutral-500">Recent generated sessions</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {recentSessions.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-neutral-300 bg-white p-16 text-center shadow-sm">
            <Clock className="mx-auto mb-4 h-12 w-12 text-neutral-400" />
            <div className="mb-2 text-base font-semibold text-neutral-900">No standup sessions yet</div>
            <div className="mb-5 text-sm text-neutral-500">Your generated sessions will appear here once you run your first standup.</div>
            <Link
              href="/dashboard"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-black px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
            >
              Generate your first standup
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {recentSessions.map((session) => (
              <div
                key={session._id}
                className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-neutral-900">{session.date}</span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                        statusColors[session.status] ?? "bg-neutral-100 text-neutral-700"
                      }`}
                    >
                      {session.status}
                    </span>
                  </div>
                  <span className="text-xs text-neutral-500">
                    {new Date(session.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                {session.generatedContent && (
                  <div className="line-clamp-4 whitespace-pre-wrap text-sm text-neutral-600">
                    {session.generatedContent}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
