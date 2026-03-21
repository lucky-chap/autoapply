"use client"

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useState } from "react"
import { Loader2, Inbox } from "lucide-react"

export function RecentApplications({ userId }: { userId: string }) {
  const applications = useQuery(api.applications.getByUser, { userId })

  if (applications === undefined) {
    return (
      <div className="p-12 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-300" />
      </div>
    )
  }

  if (applications.length === 0) {
    return (
      <div className="p-12 text-center">
        <p className="italic text-gray-400">
          No applications sent yet. Start by finding a job listing!
        </p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-50">
      {applications.slice(0, 5).map((app) => (
        <div key={app._id} className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm font-semibold text-primary">{app.company}</p>
            <p className="text-xs text-gray-500">{app.role}</p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                app.status === "Applied"
                  ? "bg-blue-50 text-blue-600"
                  : app.status === "Interview"
                    ? "bg-green-50 text-green-600"
                    : app.status === "Offer"
                      ? "bg-emerald-50 text-emerald-600"
                      : app.status === "Rejected"
                        ? "bg-red-50 text-red-500"
                        : "bg-purple-50 text-purple-600"
              }`}
            >
              {app.status}
            </span>
            <span className="text-[10px] text-gray-400">
              {new Date(app.emailSentAt ?? app.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export function CheckInboxButton() {
  const [isChecking, setIsChecking] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const handleCheck = async () => {
    setIsChecking(true)
    setResult(null)
    try {
      const res = await fetch("/api/check-inbox", { method: "POST" })
      const data = await res.json()
      if (data.updated > 0) {
        setResult(`Updated ${data.updated} application(s)!`)
      } else {
        setResult("No new replies found.")
      }
    } catch {
      setResult("Failed to check inbox.")
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
        <p className="mt-2 text-center text-xs text-gray-500">{result}</p>
      )}
    </div>
  )
}
