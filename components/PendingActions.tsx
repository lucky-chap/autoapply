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

  if (pendingActions === undefined || pendingActions.length === 0) {
    return null
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
    <section className="overflow-hidden rounded-3xl border border-black/15 bg-white">
      <div className="border-b border-black/10 p-6">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-black/70" />
          <h2 className="font-display text-xl font-bold text-primary">
            Pending Approvals
          </h2>
          <Badge className="border border-black/20 bg-[#b8ff66] font-semibold text-black">
            {pendingActions.length}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-black/60">
          These applications are waiting for your approval before sending.
        </p>
      </div>
      <div className="divide-y divide-black/10">
        {pendingActions.map((action) => (
          <div key={action._id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 shrink-0 text-black/45" />
                  <p className="truncate font-semibold text-primary">
                    {action.payload.company}
                  </p>
                </div>
                <p className="mt-0.5 text-sm text-black/60">{action.payload.role}</p>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-black/45">
                  <Mail className="h-3 w-3" />
                  {action.payload.to}
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-black/60">
                  {action.payload.coverLetter}
                </p>
                {action.source === "telegram" && (
                  <Badge className="mt-2 border border-blue-200 bg-blue-50 text-[10px] text-blue-600">
                    via Telegram
                  </Badge>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => handleApprove(action._id)}
                  disabled={loadingId === action._id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#121212] px-3 py-2 text-xs font-bold text-white transition-all hover:bg-black disabled:opacity-50"
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
                  className="inline-flex items-center gap-1.5 rounded-full border border-black/20 bg-white px-3 py-2 text-xs font-bold text-black/65 transition-all hover:bg-white disabled:opacity-50"
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
