"use client"

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { FileText, ArrowUpRight } from "lucide-react"
import Link from "next/link"

export function ResumeProfileBox({ userId }: { userId: string }) {
  const resume = useQuery(api.resumeProfiles.getByUser, { userId })
  const applications = useQuery(api.applications.getByUser, { userId })

  // Loading state
  if (resume === undefined || applications === undefined) {
    return <div className="h-64 animate-pulse rounded-2xl bg-gray-50/50" />
  }

  // Hide if either exists
  if (resume || applications.length > 0) {
    return null
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-50 p-6">
        <h2 className="font-display text-xl font-bold text-primary">
          Resume Profile
        </h2>
        <Link
          href="/dashboard/resume"
          className="flex items-center gap-1 text-sm font-semibold text-secondary hover:underline"
        >
          Edit
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="p-12 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-gray-200 bg-gray-50">
          <FileText className="h-10 w-10 text-gray-300" />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-primary">
          No resume uploaded yet
        </h3>
        <p className="mx-auto mb-6 max-w-sm text-sm text-gray-500">
          Upload your CV once to let the AI agent learn your background and
          draft perfect letters.
        </p>
        <Link
          href="/dashboard/resume"
          className="inline-flex items-center gap-2 rounded-lg bg-secondary px-6 py-2.5 font-semibold text-white transition-opacity hover:opacity-90"
        >
          Upload CV (PDF)
        </Link>
      </div>
    </section>
  )
}
