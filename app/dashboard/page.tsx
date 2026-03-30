"use client"

import { useState, type FormEvent } from "react"
import { type UIMessage, DefaultChatTransport, generateId, lastAssistantMessageIsCompleteWithToolCalls } from "ai"
import { useChat } from "@ai-sdk/react"
import { useInterruptions } from "@auth0/ai-vercel/react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import {
  Zap,
  GitBranch,
  MessageSquare,
  Mail,
  Check,
  X,
  Undo2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Clock,
  ArrowRight,
  LogOut,
} from "lucide-react"
import Link from "next/link"

import { TokenVaultInterruptHandler } from "@/components/TokenVaultInterruptHandler"
import { Button } from "@/components/ui/button"

const platformIcons: Record<string, typeof MessageSquare> = {
  slack: MessageSquare,
  gmail: Mail,
  github: GitBranch,
}

const platformColors: Record<string, string> = {
  slack: "bg-purple-500/20 text-purple-400",
  gmail: "bg-amber-500/20 text-amber-400",
  github: "bg-zinc-500/20 text-zinc-400",
}

function ActionCard({
  action,
}: {
  action: {
    _id: Id<"agentActions">
    agentName: string
    platform: string
    actionType: string
    content: string
    metadata?: string
    status: string
    confidence?: number
    reasoning?: string
    scope?: string
    isHighStakes: boolean
    executedAt?: number
    undoDeadline?: number
  }
}) {
  const [expanded, setExpanded] = useState(false)
  const approve = useMutation(api.agentActions.approve)
  const skip = useMutation(api.agentActions.skip)
  const undo = useMutation(api.agentActions.undo)
  const [loading, setLoading] = useState(false)

  const Icon = platformIcons[action.platform] ?? Zap
  const colorClass = platformColors[action.platform] ?? "bg-zinc-500/20 text-zinc-400"
  const isHighStakes = action.isHighStakes
  const canUndo =
    action.status === "executed" &&
    action.undoDeadline &&
    Date.now() < action.undoDeadline

  const handleApprove = async () => {
    setLoading(true)
    try {
      await approve({ id: action._id })
      toast.success(`${action.platform} action approved`)
    } catch (e) {
      toast.error("Failed to approve action")
    }
    setLoading(false)
  }

  const handleSkip = async () => {
    setLoading(true)
    try {
      await skip({ id: action._id })
      toast.info("Action skipped")
    } catch (e) {
      toast.error("Failed to skip action")
    }
    setLoading(false)
  }

  const handleUndo = async () => {
    setLoading(true)
    try {
      await undo({ id: action._id })
      toast.success("Action undone")
    } catch (e) {
      toast.error("Undo window expired")
    }
    setLoading(false)
  }

  return (
    <div
      className={`rounded-lg border p-4 transition-all ${
        isHighStakes
          ? "border-amber-500/30 bg-amber-500/5"
          : "border-zinc-700 bg-zinc-800/50"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}
        >
          <Icon className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-medium text-white capitalize">
              {action.agentName} Agent
            </span>
            {action.scope && (
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  isHighStakes
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-emerald-500/20 text-emerald-400"
                }`}
              >
                {action.scope}
              </span>
            )}
            {isHighStakes && (
              <span className="text-xs px-2 py-0.5 rounded bg-amber-500/30 text-amber-300">
                Step-up required
              </span>
            )}
            {action.status !== "pending" && (
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  action.status === "executed"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : action.status === "approved"
                      ? "bg-blue-500/20 text-blue-400"
                      : action.status === "skipped"
                        ? "bg-zinc-600/20 text-zinc-400"
                        : action.status === "failed"
                          ? "bg-red-500/20 text-red-400"
                          : action.status === "undone"
                            ? "bg-zinc-500/20 text-zinc-400"
                            : "bg-zinc-500/20 text-zinc-400"
                }`}
              >
                {action.status}
              </span>
            )}
          </div>

          <p className="text-sm text-zinc-400 mb-2 line-clamp-2">
            {action.content}
          </p>

          {action.confidence != null && (
            <div className="text-xs text-zinc-500">
              {action.confidence}% confident
              {action.reasoning && ` — ${action.reasoning}`}
            </div>
          )}

          {/* Expandable details */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 mt-2"
          >
            {expanded ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
            {expanded ? "Less" : "Details"}
          </button>
          {expanded && (
            <div className="mt-2 p-3 rounded bg-zinc-900 text-xs space-y-2">
              {action.reasoning && (
                <div>
                  <span className="text-zinc-500">Why this action: </span>
                  <span className="text-zinc-300">{action.reasoning}</span>
                </div>
              )}
              {action.scope && (
                <div>
                  <span className="text-zinc-500">Permission needed: </span>
                  <span className="text-zinc-300">{action.scope}</span>
                </div>
              )}
              {action.metadata && (
                <div>
                  <span className="text-zinc-500">Metadata: </span>
                  <span className="text-zinc-300 font-mono">
                    {action.metadata}
                  </span>
                </div>
              )}
              <div>
                <span className="text-zinc-500">Full content: </span>
                <span className="text-zinc-300">{action.content}</span>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 shrink-0">
          {action.status === "pending" && (
            <>
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={loading}
                className="bg-emerald-500 hover:bg-emerald-400 text-white text-xs h-8"
              >
                {loading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSkip}
                disabled={loading}
                className="border-zinc-600 text-zinc-300 text-xs h-8"
              >
                <X className="w-3 h-3" />
              </Button>
            </>
          )}
          {canUndo && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleUndo}
              disabled={loading}
              className="border-zinc-600 text-zinc-300 text-xs h-8"
            >
              <Undo2 className="w-3 h-3 mr-1" />
              Undo
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const user = useQuery(api.users.getCurrent)
  const pendingActions = useQuery(api.agentActions.listPending)
  const todaySession = useQuery(api.standupSessions.getToday)
  const sessionActions = useQuery(
    api.agentActions.getBySession,
    todaySession ? { sessionId: todaySession._id } : "skip"
  )

  const {
    messages,
    sendMessage,
    status,
    toolInterrupt,
  } = useInterruptions((handler) =>
    useChat({
      transport: new DefaultChatTransport({ api: "/api/chat" }),
      generateId,
      onError: handler((e: Error) => {
        console.error("Chat error:", e)
        toast.error("Error processing request", { description: e.message })
      }),
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    })
  )

  const [input, setInput] = useState("")
  const isLoading = status === "streaming"

  console.log("[Dashboard] toolInterrupt:", toolInterrupt, "status:", status)

  async function handleGenerateStandup() {
    await sendMessage({
      text: "Generate my standup from my recent GitHub activity. Then propose actions to share it on Slack and via email.",
    })
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    await sendMessage({ text: input })
    setInput("")
  }

  // Combine all actions for display
  const allActions = sessionActions ?? pendingActions ?? []

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Top bar */}
      <header className="border-b border-zinc-800 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-display font-bold text-white">
              DevStandup AI
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-400">{user?.email}</span>
            <Link
              href="/dashboard/history"
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              History
            </Link>
            <Link
              href="/dashboard/settings"
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Settings
            </Link>
            <a
              href="/auth/logout"
              className="text-sm text-zinc-500 hover:text-white transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </a>
          </div>
        </div>
      </header>

      {/* Main content: two-panel layout */}
      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-57px)]">
        {/* Left Panel: Agent Pipeline */}
        <div className="flex flex-col gap-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-emerald-400" />
              Agent Pipeline
            </h2>
            {todaySession && (
              <span className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400">
                {todaySession.status}
              </span>
            )}
          </div>

          {/* Generate button */}
          {!isLoading && messages.length === 0 && (
            <button
              onClick={handleGenerateStandup}
              className="w-full rounded-xl border-2 border-dashed border-zinc-700 hover:border-emerald-500/50 bg-zinc-900 p-8 text-center transition-colors group"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-emerald-500/20 transition-colors">
                <Zap className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="text-white font-medium mb-1">
                Generate Today&apos;s Standup
              </div>
              <div className="text-sm text-zinc-500">
                Fetch your GitHub activity and create a standup with AI
              </div>
            </button>
          )}

          {/* Chat messages */}
          <div className="flex-1 space-y-3 overflow-y-auto">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-lg p-3 text-sm ${
                  m.role === "user"
                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-100"
                    : "bg-zinc-800 border border-zinc-700 text-zinc-300"
                }`}
              >
                <div className="text-xs text-zinc-500 mb-1 capitalize">
                  {m.role === "user" ? "You" : "DevStandup AI"}
                </div>
                {m.parts?.map((part, i) => {
                  if (part.type === "text") {
                    return (
                      <div key={i} className="whitespace-pre-wrap">
                        {part.text}
                      </div>
                    )
                  }
                  if (part.type?.startsWith("tool-")) {
                    const toolPart = part as any
                    return (
                      <div
                        key={i}
                        className="text-xs text-zinc-500 italic mt-1"
                      >
                        Calling {toolPart.toolName ?? "tool"}...
                      </div>
                    )
                  }
                  return null
                })}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </div>
            )}

            {/* Token Vault interrupt handler */}
            <TokenVaultInterruptHandler interrupt={toolInterrupt} />
          </div>

          {/* Chat input */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your standup or customize actions..."
              className="flex-1 rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/50"
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-emerald-500 hover:bg-emerald-400 text-white"
            >
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        </div>

        {/* Right Panel: Action Queue */}
        <div className="flex flex-col gap-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              Action Queue
            </h2>
            {pendingActions && pendingActions.length > 0 && (
              <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400">
                {pendingActions.length} pending
              </span>
            )}
          </div>

          {allActions.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 rounded-xl bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-zinc-600" />
                </div>
                <div className="text-zinc-500 text-sm">
                  No actions yet. Generate a standup to see
                  <br />
                  proposed actions appear here.
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto flex-1">
              {allActions.map((action: any) => (
                <ActionCard key={action._id} action={action} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
