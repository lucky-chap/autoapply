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
      <div className="animate-pulse rounded-[1.4rem] border border-black/10 bg-white p-6">
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
    <div className="rounded-[1.4rem] border border-black/10 bg-white p-6">
      <div className="mb-3 flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-blue-500" />
        <h3 className="font-bold text-primary">Telegram Bot</h3>
      </div>

      {link ? (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <p className="text-sm text-black/65">
              Connected — send job descriptions directly from Telegram
            </p>
          </div>
          <p className="mb-4 text-xs text-black/45">
            Linked {new Date(link.linkedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          <button
            onClick={handleUnlink}
            disabled={isUnlinking}
            className="inline-flex items-center gap-1.5 rounded-full border border-red-200 px-3 py-2 text-xs font-bold text-red-600 transition-all hover:bg-red-50 disabled:opacity-50"
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
          <p className="mb-3 text-sm text-black/60">
            Connect Telegram to send job descriptions and approve applications on the go.
          </p>
          <div className="rounded-xl border border-black/10 bg-white p-4 text-sm text-black/65">
            <p className="mb-2 font-semibold">How to connect:</p>
            <ol className="list-inside list-decimal space-y-1 text-xs text-black/55">
              <li>Open the AutoApply bot in Telegram</li>
              <li>Send <code className="rounded bg-white px-1.5 py-0.5 text-primary">/link</code></li>
              <li>Click the link the bot sends you</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}
