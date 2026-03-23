"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useState } from "react"
import { MessageCircle, Unlink, Loader2, CheckCircle2 } from "lucide-react"

export function TelegramLinkCard({ userId }: { userId: string }) {
  const link = useQuery(api.telegramLinks.getLinkByUserId, { userId })
  const unlinkMutation = useMutation(api.telegramLinks.unlink)
  const [isUnlinking, setIsUnlinking] = useState(false)

  if (link === undefined) {
    return (
      <div className="animate-pulse rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="h-5 w-32 rounded bg-gray-100" />
        <div className="mt-3 h-4 w-48 rounded bg-gray-50" />
      </div>
    )
  }

  const handleUnlink = async () => {
    setIsUnlinking(true)
    try {
      await unlinkMutation({ userId })
    } catch (err) {
      console.error("Unlink failed:", err)
    } finally {
      setIsUnlinking(false)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <MessageCircle className="h-5 w-5 text-blue-500" />
        <h3 className="font-bold text-primary">Telegram Bot</h3>
      </div>

      {link ? (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <p className="text-sm text-gray-600">
              Connected — send job descriptions directly from Telegram
            </p>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Linked {new Date(link.linkedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          <button
            onClick={handleUnlink}
            disabled={isUnlinking}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 transition-all hover:bg-red-50 disabled:opacity-50"
          >
            {isUnlinking ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Unlink className="h-3.5 w-3.5" />
            )}
            Disconnect
          </button>
        </div>
      ) : (
        <div>
          <p className="text-sm text-gray-500 mb-3">
            Connect Telegram to send job descriptions and approve applications on the go.
          </p>
          <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
            <p className="font-semibold mb-2">How to connect:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs text-gray-500">
              <li>Open the AutoApply bot in Telegram</li>
              <li>Send <code className="rounded bg-gray-100 px-1.5 py-0.5 text-primary">/link</code></li>
              <li>Click the link the bot sends you</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}
