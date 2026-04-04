"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { useState } from "react"
import {
  Clock,
  CheckCircle2,
  XCircle,
  Mail,
  Building2,
  Loader2,
  MessageSquare,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function PendingActions({ userId }: { userId: string }) {
  const pendingActions = useQuery(api.pendingActions.getByUser, { userId })
  const approveMutation = useMutation(api.pendingActions.approve)
  const rejectMutation = useMutation(api.pendingActions.reject)

  const [loadingId, setLoadingId] = useState<string | null>(null)

  if (pendingActions === undefined) {
    return (
      <Card className="border-black/5 shadow-sm">
        <CardHeader className="border-b border-black/5 p-5">
          <div className="flex items-center gap-2">
            <CardTitle className="font-display text-xl font-semibold">
              Pending Approvals
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex h-32 items-center justify-center text-sm text-black/40">
          Loading...
        </CardContent>
      </Card>
    )
  }

  if (pendingActions.length === 0) {
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
    <Card className="overflow-hidden border-black/5 shadow-sm">
      <CardHeader className="border-b border-black/5 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="font-display text-xl font-semibold text-black">
                  Pending Approvals
                </CardTitle>
                <Badge className="h-5 border-black/10 bg-[#b8ff66] px-1.5 text-[10px] font-bold text-black hover:bg-[#b8ff66]/80">
                  {pendingActions.length}
                </Badge>
              </div>
              <CardDescription className="text-sm text-black/50">
                Wait for your approval before sending.
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">Company & Role</TableHead>
              <TableHead className="hidden md:table-cell">Recipient</TableHead>
              <TableHead className="pr-5 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingActions.map((action) => (
              <TableRow
                key={action._id}
                className="group transition-colors hover:bg-black/1"
              >
                <TableCell className="py-4 pl-5 align-top">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/5">
                      <Building2 className="h-4 w-4 text-black/40" />
                    </div>
                    <div className="min-w-0">
                      <p className="leading-none font-semibold text-black">
                        {action.payload.company}
                      </p>
                      <p className="mt-1.5 text-xs text-black/60">
                        {action.payload.role}
                      </p>
                      <p className="mt-2 line-clamp-1 text-[11px] text-black/40 italic">
                        "{action.payload.coverLetter.substring(0, 60)}..."
                      </p>
                      {action.source === "telegram" && (
                        <Badge
                          variant="outline"
                          className="mt-2 h-4 border-blue-100 bg-blue-50/50 px-1 py-0 text-[10px] font-medium text-blue-600"
                        >
                          via Telegram
                        </Badge>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden py-4 align-top md:table-cell">
                  <div className="flex items-center gap-1.5 text-xs text-black/60">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="max-w-[150px] truncate">
                      {action.payload.to}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="py-4 pr-5 text-right align-top">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(action._id)}
                      disabled={loadingId === action._id}
                      className="h-8 rounded-full border-black/10 text-xs font-bold text-black/60 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                    >
                      <XCircle className="mr-1 h-3.5 w-3.5" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleApprove(action._id)}
                      disabled={loadingId === action._id}
                      className="h-8 rounded-full bg-black text-xs font-bold text-white transition-colors hover:bg-black/90"
                    >
                      {loadingId === action._id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                      )}
                      Approve
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
