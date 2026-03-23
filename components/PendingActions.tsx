"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { useState } from "react"
import { Clock, CheckCircle2, XCircle, Mail, Building2, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export function PendingActions({ userId }: { userId: string }) {
  const pendingActions = useQuery(api.pendingActions.getByUser, { userId })
  const approveMutation = useMutation(api.pendingActions.approve)
  const rejectMutation = useMutation(api.pendingActions.reject)

  const [loadingId, setLoadingId] = useState<string | null>(null)

  if (pendingActions === undefined) {
    return (
      <div className="animate-pulse space-y-3 p-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-gray-50" />
        ))}
      </div>
    )
  }

  if (pendingActions.length === 0) {
    return null // Don't show the section if no pending actions
  }

  const handleApprove = async (id: Id<"pendingActions">) => {
    setLoadingId(id)
    try {
      await approveMutation({ id })
    } catch (err) {
      console.error("Approve failed:", err)
    } finally {
      setLoadingId(null)
    }
  }

  const handleReject = async (id: Id<"pendingActions">) => {
    setLoadingId(id)
    try {
      await rejectMutation({ id })
    } catch (err) {
      console.error("Reject failed:", err)
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-amber-100 bg-amber-50/50 shadow-sm">
      <div className="border-b border-amber-100 p-6">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-amber-600" />
          <h2 className="font-display text-xl font-bold text-primary">
            Pending Approvals
          </h2>
          <Badge className="bg-amber-100 text-amber-700 border-amber-200 border font-semibold">
            {pendingActions.length}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          These applications are waiting for your approval before sending.
        </p>
      </div>
      <div className="divide-y divide-amber-100">
        {pendingActions.map((action) => (
          <div key={action._id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-gray-400 shrink-0" />
                  <p className="font-semibold text-primary truncate">
                    {action.payload.company}
                  </p>
                </div>
                <p className="mt-0.5 text-sm text-gray-500">{action.payload.role}</p>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
                  <Mail className="h-3 w-3" />
                  {action.payload.to}
                </div>
                <p className="mt-2 text-xs text-gray-500 line-clamp-2">
                  {action.payload.coverLetter}
                </p>
                {action.source === "telegram" && (
                  <Badge className="mt-2 bg-blue-50 text-blue-600 border-blue-200 border text-[10px]">
                    via Telegram
                  </Badge>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => handleApprove(action._id)}
                  disabled={loadingId === action._id}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-white transition-all hover:bg-emerald-600 disabled:opacity-50"
                >
                  {loadingId === action._id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  Approve
                </button>
                <button
                  onClick={() => handleReject(action._id)}
                  disabled={loadingId === action._id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 transition-all hover:bg-gray-50 disabled:opacity-50"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
