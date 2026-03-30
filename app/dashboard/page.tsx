"use client"

import { useState, type FormEvent } from "react"
import {
  DefaultChatTransport,
  generateId,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai"
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

const platformStyles: Record<string, string> = {
  slack: "bg-neutral-100 text-neutral-700 border border-neutral-200",
  gmail: "bg-neutral-100 text-neutral-700 border border-neutral-200",
  github: "bg-neutral-100 text-neutral-700 border border-neutral-200",
}

type DashboardAction = {
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

function ActionCard({
  action,
}: {
  action: DashboardAction
}) {
  const [expanded, setExpanded] = useState(false)
  const approve = useMutation(api.agentActions.approve)
  const skip = useMutation(api.agentActions.skip)
  const undo = useMutation(api.agentActions.undo)
  const [loading, setLoading] = useState(false)

  const Icon = platformIcons[action.platform] ?? Zap
  const styleClass = platformStyles[action.platform] ?? "bg-neutral-100 text-neutral-700 border border-neutral-200"
  const isHighStakes = action.isHighStakes
  const canUndo = action.status === "executed" && Boolean(action.undoDeadline)

  const handleApprove = async () => {
    setLoading(true)
    try {
      await approve({ id: action._id })
      toast.success(`${action.platform} action approved`)
    } catch {
      toast.error("Failed to approve action")
    }
    setLoading(false)
  }

  const handleSkip = async () => {
    setLoading(true)
    try {
      await skip({ id: action._id })
      toast.info("Action skipped")
    } catch {
      toast.error("Failed to skip action")
    }
    setLoading(false)
  }

  const handleUndo = async () => {
    setLoading(true)
    try {
      await undo({ id: action._id })
      toast.success("Action undone")
    } catch {
      toast.error("Undo window expired")
    }
    setLoading(false)
  }

  return (
    <div
      className={`rounded-2xl border bg-white p-4 shadow-sm transition-all ${
        isHighStakes
          ? "border-amber-300/70 ring-1 ring-amber-100"
          : "border-neutral-200"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${styleClass}`}
        >
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-neutral-900 capitalize">
              {action.agentName} Agent
            </span>
            {action.scope && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  isHighStakes
                    ? "bg-amber-50 text-amber-700"
                    : "bg-neutral-100 text-neutral-700"
                }`}
              >
                {action.scope}
              </span>
            )}
            {isHighStakes && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                Step-up required
              </span>
            )}
            {action.status !== "pending" && (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                {action.status}
              </span>
            )}
          </div>

          <p className="mb-2 line-clamp-2 text-sm text-neutral-600">{action.content}</p>

          {action.confidence != null && (
            <div className="text-xs text-neutral-500">
              {action.confidence}% confident
              {action.reasoning && ` - ${action.reasoning}`}
            </div>
          )}

          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 inline-flex items-center gap-1 text-xs text-neutral-500 transition-colors hover:text-neutral-900"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Less" : "Details"}
          </button>

          {expanded && (
            <div className="mt-3 space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs">
              {action.reasoning && (
                <div>
                  <span className="text-neutral-500">Why this action: </span>
                  <span className="text-neutral-700">{action.reasoning}</span>
                </div>
              )}
              {action.scope && (
                <div>
                  <span className="text-neutral-500">Permission needed: </span>
                  <span className="text-neutral-700">{action.scope}</span>
                </div>
              )}
              {action.metadata && (
                <div>
                  <span className="text-neutral-500">Metadata: </span>
                  <span className="font-mono text-neutral-700">{action.metadata}</span>
                </div>
              )}
              <div>
                <span className="text-neutral-500">Full content: </span>
                <span className="text-neutral-700">{action.content}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 gap-2">
          {action.status === "pending" && (
            <>
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={loading}
                className="min-w-8"
              >
                {loading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSkip}
                disabled={loading}
                className="min-w-8"
              >
                <X className="h-3 w-3" />
              </Button>
            </>
          )}
          {canUndo && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleUndo}
              disabled={loading}
            >
              <Undo2 className="mr-1 h-3 w-3" />
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

  const { messages, sendMessage, status, toolInterrupt } = useInterruptions((handler) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useChat({
      transport: new DefaultChatTransport({ api: "/api/chat" }),
      generateId,
      onError: handler((e: Error) => {
        console.error("Chat error:", e)
        toast.error("Error processing request", { description: e.message })
      }),
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    })
  })

  const [input, setInput] = useState("")
  const [repoInput, setRepoInput] = useState("")
  const isLoading = status === "streaming"

  async function handleGenerateStandup() {
    const repos = repoInput
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean)

    const repoInstruction = repos.length
      ? `Focus on these repos: ${repos.map((r) => `"${r}"`).join(", ")}.`
      : "Search broadly across all my repos."

    await sendMessage({
      text: `Generate my standup from my recent GitHub activity. ${repoInstruction} Then propose actions to share it on Slack and via email.`,
    })
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    await sendMessage({ text: input })
    setInput("")
  }

  const allActions = (sessionActions ?? pendingActions ?? []) as DashboardAction[]

  return (
    <div className="relative min-h-screen bg-neutral-100 text-neutral-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-white blur-3xl" />
        <div className="absolute top-14 right-0 h-64 w-64 rounded-full bg-neutral-200/70 blur-3xl" />
      </div>

      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-black text-white shadow-sm">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <p className="font-display text-sm font-semibold tracking-wide text-neutral-900">
                DevStandup AI
              </p>
              <p className="text-xs text-neutral-500">Control center</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-neutral-600 sm:inline">
              {user?.email ?? "Loading profile..."}
            </span>
            <Link
              href="/dashboard/history"
              className="rounded-full px-3 py-1.5 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            >
              History
            </Link>
            <Link
              href="/dashboard/settings"
              className="rounded-full px-3 py-1.5 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            >
              Settings
            </Link>
            <Link
              href="/auth/logout"
              className="grid h-8 w-8 place-items-center rounded-full border border-neutral-300 text-neutral-500 transition-colors hover:border-neutral-400 hover:text-neutral-900"
              aria-label="Log out"
            >
              <LogOut className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-2">
        <section className="flex max-h-[calc(100vh-8.5rem)] flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
              <GitBranch className="h-4 w-4" />
              Agent Pipeline
            </h2>
            {todaySession && (
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600">
                {todaySession.status}
              </span>
            )}
          </div>

          {!isLoading && messages.length === 0 && (
            <div className="mb-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 transition-colors hover:border-neutral-500 hover:bg-white">
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-neutral-300 bg-white">
                <Zap className="h-5 w-5 text-neutral-700" />
              </div>
              <div className="mb-1 text-center text-base font-semibold text-neutral-900">
                Generate Today&apos;s Standup
              </div>
              <div className="mb-4 text-center text-sm text-neutral-500">
                Gather GitHub activity and draft updates with reviewable actions.
              </div>

              <div className="mb-3">
                <label
                  htmlFor="repo-input"
                  className="mb-1.5 block text-xs font-medium text-neutral-600"
                >
                  Repos to check (optional)
                </label>
                <input
                  id="repo-input"
                  value={repoInput}
                  onChange={(e) => setRepoInput(e.target.value)}
                  placeholder="owner/repo, owner/another-repo"
                  className="h-9 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none"
                />
                <p className="mt-1 text-xs text-neutral-400">
                  Comma-separated. Leave empty to search all repos.
                </p>
              </div>

              <button
                onClick={handleGenerateStandup}
                className="w-full rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
              >
                Generate Standup
              </button>
            </div>
          )}

          <div className="flex-1 space-y-3 overflow-y-auto pr-1">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-2xl border p-3 text-sm ${
                  m.role === "user"
                    ? "border-neutral-300 bg-neutral-100 text-neutral-900"
                    : "border-neutral-200 bg-white text-neutral-700"
                }`}
              >
                <div className="mb-1 text-xs font-medium capitalize text-neutral-500">
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
                    const toolPart = part as { toolName?: string }
                    return (
                      <div key={i} className="mt-1 text-xs italic text-neutral-500">
                        Calling {toolPart.toolName ?? "tool"}...
                      </div>
                    )
                  }
                  return null
                })}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </div>
            )}

            <TokenVaultInterruptHandler interrupt={toolInterrupt} />
          </div>

          <form onSubmit={handleSubmit} className="mt-4 flex gap-2 border-t border-neutral-200 pt-4">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your standup or customize actions..."
              className="h-10 flex-1 rounded-xl border border-neutral-300 bg-white px-4 text-sm text-neutral-900 placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        </section>

        <section className="flex max-h-[calc(100vh-8.5rem)] flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
              <Clock className="h-4 w-4" />
              Action Queue
            </h2>
            {pendingActions && pendingActions.length > 0 && (
              <span className="rounded-full bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white">
                {pendingActions.length} pending
              </span>
            )}
          </div>

          {allActions.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50">
              <div className="text-center">
                <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl border border-neutral-300 bg-white">
                  <Clock className="h-7 w-7 text-neutral-400" />
                </div>
                <div className="text-sm text-neutral-500">
                  No actions yet. Generate a standup to see
                  <br />
                  proposed actions appear here.
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {allActions.map((action) => (
                <ActionCard key={action._id} action={action} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
