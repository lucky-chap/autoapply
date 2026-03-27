"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import {
  Briefcase,
  MapPin,
  ExternalLink,
  Check,
  X,
  Sparkles,
  Search,
} from "lucide-react"
import { useState } from "react"

export function DiscoveredJobs({ userId }: { userId: string }) {
  const [filter, setFilter] = useState<"new" | "approved" | "ignored">("new")
  const matches = useQuery(api.sourcing.userMatches.getMatchesForUser, {
    userId,
    status: filter,
  })
  const updateStatus = useMutation(api.sourcing.userMatches.updateStatus)

  const handleApprove = async (matchId: Id<"userJobMatches">) => {
    await updateStatus({ matchId, status: "approved" })
  }

  const handleIgnore = async (matchId: Id<"userJobMatches">) => {
    await updateStatus({ matchId, status: "ignored" })
  }

  const filterTabs = [
    { key: "new" as const, label: "New", count: null },
    { key: "approved" as const, label: "Approved", count: null },
    { key: "ignored" as const, label: "Ignored", count: null },
  ]

  return (
    <article className="overflow-hidden rounded-3xl border border-black/15 bg-white">
      <div className="flex items-center justify-between border-b border-black/10 p-5">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <Search className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold">
              Discovered Jobs
            </h2>
            <p className="text-sm text-black/60">
              AI-matched from open job boards.
            </p>
          </div>
        </div>
        <span className="rounded bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 uppercase">
          Auto
        </span>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-black/10 px-5 py-2">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === tab.key
                ? "bg-[#121212] text-white"
                : "text-black/60 hover:bg-black/5"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="max-h-[480px] overflow-y-auto">
        {matches === undefined ? (
          <div className="p-8 text-center text-sm text-black/50">
            Loading matches…
          </div>
        ) : matches.length === 0 ? (
          <div className="p-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-black/5">
              <Sparkles className="h-5 w-5 text-black/40" />
            </div>
            <p className="text-sm font-medium text-black/70">
              {filter === "new"
                ? "No new matches yet"
                : filter === "approved"
                  ? "No approved jobs"
                  : "No ignored jobs"}
            </p>
            <p className="mt-1 text-xs text-black/50">
              {filter === "new"
                ? "Jobs matching your profile will appear here automatically."
                : ""}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-black/5">
            {matches.map((match) => (
              <div
                key={match._id}
                className="group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-black/[0.02]"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <h3 className="text-sm font-semibold leading-tight truncate">
                      {match.job.title}
                    </h3>
                    {match.matchScore && (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          match.matchScore >= 80
                            ? "bg-green-100 text-green-700"
                            : match.matchScore >= 60
                              ? "bg-amber-100 text-amber-700"
                              : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {match.matchScore}%
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-black/55">
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-3 w-3" />
                      {match.job.company}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {match.job.location}
                    </span>
                    {match.job.salary && (
                      <span className="font-medium text-green-700">
                        {match.job.salary}
                      </span>
                    )}
                  </div>

                  {match.matchReasoning && (
                    <p className="mt-1.5 text-xs leading-relaxed text-black/50 line-clamp-2">
                      {match.matchReasoning}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <a
                    href={match.job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-black/10 p-1.5 text-black/50 transition-colors hover:bg-black/5 hover:text-black"
                    title="View listing"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>

                  {filter === "new" && (
                    <>
                      <button
                        onClick={() => handleApprove(match._id)}
                        className="rounded-lg border border-green-200 bg-green-50 p-1.5 text-green-700 transition-colors hover:bg-green-100"
                        title="Approve"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleIgnore(match._id)}
                        className="rounded-lg border border-black/10 p-1.5 text-black/40 transition-colors hover:bg-red-50 hover:text-red-600"
                        title="Ignore"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}
