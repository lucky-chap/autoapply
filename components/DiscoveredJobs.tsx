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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

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
    { key: "new" as const, label: "New" },
    { key: "approved" as const, label: "Approved" },
    { key: "ignored" as const, label: "Ignored" },
  ]

  return (
    <Card className="border-black/5 shadow-sm overflow-hidden">
      <CardHeader className="border-b border-black/5 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <Search className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="font-display text-xl font-semibold text-black">
                  Discovered Jobs
                </CardTitle>
                <Badge variant="outline" className="h-5 text-[10px] font-bold border-blue-100 bg-blue-50/50 text-blue-600 uppercase">
                  Auto
                </Badge>
              </div>
              <CardDescription className="text-sm text-black/50">
                AI-matched from open job boards.
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <div className="flex gap-1 border-b border-black/5 px-5 py-2 bg-black/1">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`rounded-lg px-3 py-1.5 text-[11px] font-bold tracking-tight transition-colors ${
              filter === tab.key
                ? "bg-black text-white"
                : "text-black/50 hover:bg-black/5"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <CardContent className="p-0">
        <div className="max-h-[500px] overflow-y-auto">
          {matches === undefined ? (
            <div className="flex h-40 items-center justify-center text-sm text-black/40">
              Loading matches...
            </div>
          ) : matches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-black/5">
                <Sparkles className="h-5 w-5 text-black/20" />
              </div>
              <p className="text-sm font-medium text-black/60">
                {filter === "new"
                  ? "No new matches yet"
                  : filter === "approved"
                    ? "No approved jobs"
                    : "No ignored jobs"}
              </p>
              <p className="mt-1 text-xs text-black/40 px-6 max-w-xs">
                {filter === "new"
                  ? "Jobs matching your profile will appear here automatically."
                  : ""}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">Job Details</TableHead>
                  <TableHead className="hidden sm:table-cell">Match</TableHead>
                  <TableHead className="text-right pr-5">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map((match) => (
                  <TableRow key={match._id} className="group transition-colors hover:bg-black/1">
                    <TableCell className="py-4 pl-5 align-top">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-black leading-none truncate max-w-[200px]">
                            {match.job.title}
                          </p>
                          {match.job.salary && (
                            <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 rounded cursor-default" title="Salary range">
                              {match.job.salary}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2.5 text-[11px] text-black/50">
                          <span className="flex items-center gap-1">
                            <Briefcase className="h-3 w-3" />
                            {match.job.company}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {match.job.location}
                          </span>
                        </div>
                        {match.matchReasoning && (
                          <p className="mt-2 text-[11px] leading-relaxed text-black/40 line-clamp-2 max-w-sm">
                            {match.matchReasoning}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-4 hidden sm:table-cell align-top">
                      {match.matchScore && (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                             <div className="h-1.5 w-16 bg-black/5 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${
                                    match.matchScore >= 80 ? "bg-green-500" : 
                                    match.matchScore >= 60 ? "bg-amber-500" : "bg-gray-400"
                                  }`}
                                  style={{ width: `${match.matchScore}%` }}
                                />
                             </div>
                             <span className="text-[10px] font-bold text-black/60">{match.matchScore}%</span>
                          </div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-4 pr-5 text-right align-top">
                      <div className="flex items-center justify-end gap-1.5">
                        <a 
                          href={match.job.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          title="View Listing"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 bg-white text-black/40 transition-colors hover:bg-black/5 hover:text-black"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>

                        {filter === "new" && (
                          <>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleIgnore(match._id)}
                              className="h-8 w-8 rounded-lg border-black/10 text-black/40 hover:text-red-600 hover:bg-red-50 hover:border-red-100 transition-colors"
                              title="Ignore"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              onClick={() => handleApprove(match._id)}
                              className="h-8 w-8 rounded-lg bg-black text-white hover:bg-black/90 transition-colors"
                              title="Approve"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
