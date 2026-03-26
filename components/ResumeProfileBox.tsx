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
    return <div className="h-64 animate-pulse rounded-[1.6rem] bg-white" />
  }

  // Hide if either exists
  if (resume || applications.length > 0) {
    return null
  }

  return (
    <section className="overflow-hidden rounded-[1.6rem] border border-black/10 bg-white">
      <div className="flex items-center justify-between border-b border-black/10 p-6">
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
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-black/20 bg-white">
          <FileText className="h-10 w-10 text-gray-300" />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-primary">
          No resume uploaded yet
        </h3>
        <p className="mx-auto mb-6 max-w-sm text-sm text-black/60">
          Upload your CV once to let the AI agent learn your background and
          draft perfect letters.
        </p>
        <Link
          href="/dashboard/resume"
          className="inline-flex items-center gap-2 rounded-full bg-secondary px-6 py-2.5 font-semibold text-white transition-opacity hover:opacity-90"
        >
          Upload CV (PDF)
        </Link>
      </div>
    </section>
  )
}
