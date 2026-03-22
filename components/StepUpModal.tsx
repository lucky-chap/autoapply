"use client"

import { useState } from "react"
import { ShieldCheck, Loader2, X } from "lucide-react"

interface StepUpModalProps {
  isOpen: boolean
  onClose: () => void
  onAuthenticated: () => void
}

export function StepUpModal({
  isOpen,
  onClose,
  onAuthenticated,
}: StepUpModalProps) {
  const [isRedirecting, setIsRedirecting] = useState(false)

  if (!isOpen) return null

  const handleStepUp = () => {
    setIsRedirecting(true)
    // Redirect to Auth0 login with step-up auth parameters
    // After re-auth, the user will be redirected back and the session will have fresh auth_time
    const returnTo = encodeURIComponent(window.location.pathname + "?stepped_up=true")
    window.location.href = `/auth/login?prompt=login&returnTo=${returnTo}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50">
            <ShieldCheck className="h-8 w-8 text-amber-600" />
          </div>

          <h2 className="mb-2 font-display text-xl font-bold text-primary">
            Step-Up Authentication Required
          </h2>
          <p className="mb-6 text-sm leading-relaxed text-gray-500">
            Sending an application email is a high-stakes action. To protect
            your account, please re-authenticate to confirm your identity.
          </p>

          <div className="mb-6 rounded-xl border border-amber-100 bg-amber-50 p-4 text-left">
            <p className="text-xs font-semibold text-amber-800">
              Why is this required?
            </p>
            <p className="mt-1 text-xs text-amber-700">
              AutoApply uses Auth0 step-up authentication before any email is
              sent through your Gmail. This ensures no email goes out without
              your explicit, recent confirmation.
            </p>
          </div>

          <button
            onClick={handleStepUp}
            disabled={isRedirecting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
          >
            {isRedirecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Redirecting to Auth0...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                Confirm Identity
              </>
            )}
          </button>

          <p className="mt-4 text-[10px] text-gray-400">
            You'll be redirected to Auth0 for verification, then returned here.
          </p>
        </div>
      </div>
    </div>
  )
}
