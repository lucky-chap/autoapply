"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { CheckCircle2, MessageCircle, X } from "lucide-react"

function TelegramLinkedDialogInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (searchParams.get("telegram") === "linked") {
      setOpen(true)
    }
  }, [searchParams])

  const handleClose = () => {
    setOpen(false)
    const url = new URL(window.location.href)
    url.searchParams.delete("telegram")
    router.replace(url.pathname + url.search, { scroll: false })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl">
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        </div>

        <h2 className="mb-2 text-xl font-bold text-primary">
          Telegram Connected!
        </h2>
        <p className="mb-6 text-sm text-gray-500">
          Your Telegram account is now linked. Send any job description to the
          bot and it&apos;ll generate a cover letter and send it for you.
        </p>

        <div className="flex flex-col gap-3">
          <a
            href="https://t.me"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2AABEE] px-5 py-2.5 font-semibold text-white shadow-lg shadow-[#2AABEE]/20 transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-95"
          >
            <MessageCircle className="h-5 w-5" />
            Open Telegram
          </a>
          <button
            onClick={handleClose}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
          >
            Stay on Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}

export function TelegramLinkedDialog() {
  return (
    <Suspense fallback={null}>
      <TelegramLinkedDialogInner />
    </Suspense>
  )
}
