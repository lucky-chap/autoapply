"use client"

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import Link from "next/link"
import {
  Zap,
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  SkipForward,
} from "lucide-react"

const statusIcons: Record<string, typeof CheckCircle> = {
  executed: CheckCircle,
  skipped: SkipForward,
  failed: XCircle,
}

const statusColors: Record<string, string> = {
  gathering: "text-blue-400",
  drafting: "text-yellow-400",
  ready: "text-emerald-400",
  distributed: "text-emerald-400",
}

export default function HistoryPage() {
  const sessions = useQuery(api.standupSessions.getRecent, { limit: 20 })

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="border-b border-zinc-800 px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span className="font-display font-bold text-white">
              Standup History
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {!sessions || sessions.length === 0 ? (
          <div className="text-center py-16">
            <Clock className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <div className="text-zinc-400">No standup sessions yet.</div>
            <Link
              href="/dashboard"
              className="text-emerald-400 text-sm hover:underline mt-2 inline-block"
            >
              Generate your first standup
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session: any) => (
              <div
                key={session._id}
                className="rounded-lg border border-zinc-800 bg-zinc-900 p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-white">
                      {session.date}
                    </span>
                    <span
                      className={`text-xs capitalize ${statusColors[session.status] ?? "text-zinc-400"}`}
                    >
                      {session.status}
                    </span>
                  </div>
                  <span className="text-xs text-zinc-500">
                    {new Date(session.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                {session.generatedContent && (
                  <div className="text-sm text-zinc-400 whitespace-pre-wrap line-clamp-4">
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
