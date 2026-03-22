"use client"

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useState } from "react"
import { Loader2, Inbox, Eye, Mail, Building2, Calendar, Sparkles } from "lucide-react"
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
  Applied: "bg-blue-50 text-blue-700 border-blue-200",
  Replied: "bg-purple-50 text-purple-700 border-purple-200",
  Interview: "bg-amber-50 text-amber-700 border-amber-200",
  Offer: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Rejected: "bg-red-50 text-red-600 border-red-200",
}

export function ApplicationsTable({ userId }: { userId: string }) {
  const applications = useQuery(api.applications.getByUser, { userId })
  const router = useRouter()

  if (applications === undefined) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 animate-pulse">
            <div className="h-8 w-8 rounded-lg bg-gray-100" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded bg-gray-100" />
              <div className="h-3 w-48 rounded bg-gray-50" />
            </div>
            <div className="hidden sm:block h-3 w-24 rounded bg-gray-50" />
            <div className="h-6 w-16 rounded-full bg-gray-100" />
            <div className="h-4 w-8 rounded bg-gray-50" />
            <div className="hidden sm:block h-3 w-20 rounded bg-gray-50" />
          </div>
        ))}
      </div>
    )
  }

  if (applications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50">
          <Mail className="h-8 w-8 text-gray-300" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-primary">No applications yet</p>
          <p className="mt-1 max-w-xs text-sm text-gray-400">
            Paste a job description and let the AI craft a personalised cover letter for you.
          </p>
        </div>
        <Link
          href="/dashboard/new"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 active:scale-95"
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
          <TableHead>Company</TableHead>
          <TableHead className="hidden sm:table-cell">Recipient</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-center">Opens</TableHead>
          <TableHead className="hidden sm:table-cell">Sent</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {applications.map((app) => (
          <TableRow
            key={app._id}
            className="cursor-pointer"
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
                className={`${statusStyles[app.status] ?? "bg-gray-50 text-gray-600 border-gray-200"} border font-semibold`}
              >
                {app.status}
              </Badge>
            </TableCell>
            <TableCell className="text-center">
              {(app.openCount ?? 0) > 0 ? (
                <span className="inline-flex items-center gap-1 text-blue-600">
                  <Eye className="h-3.5 w-3.5" />
                  <span className="text-sm font-semibold">
                    {app.openCount}
                  </span>
                </span>
              ) : (
                <span className="text-gray-300">&mdash;</span>
              )}
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              <span className="flex items-center gap-1.5 text-gray-400">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(
                  app.emailSentAt ?? app.createdAt
                ).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
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
  const [result, setResult] = useState<{ message: string; isError: boolean } | null>(null)

  const handleCheck = async () => {
    setIsChecking(true)
    setResult(null)
    try {
      const res = await fetch("/api/check-inbox", { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        setResult({ message: data.error || "Failed to check inbox.", isError: true })
      } else if (data.updated > 0) {
        setResult({ message: `Updated ${data.updated} application(s)!`, isError: false })
      } else {
        setResult({ message: "No new replies found.", isError: false })
      }
    } catch {
      setResult({ message: "Network error — check your connection.", isError: true })
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleCheck}
        disabled={isChecking}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-primary transition-all hover:bg-gray-50 disabled:opacity-50"
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
        <p className={`mt-2 text-center text-xs ${result.isError ? "text-red-500" : "text-gray-500"}`}>
          {result.message}
        </p>
      )}
    </div>
  )
}
