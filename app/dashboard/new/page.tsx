"use client"

import { useState, useEffect, Suspense } from "react"
import { useUser } from "@auth0/nextjs-auth0/client"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useSearchParams } from "next/navigation"
import { StepUpModal } from "@/components/StepUpModal"
import Link from "next/link"
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Send,
  Pencil,
  CheckCircle2,
  AlertCircle,
  Wand2,
} from "lucide-react"

type Step = "input" | "preview" | "sent"

export default function NewApplicationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
        </div>
      }
    >
      <NewApplicationContent />
    </Suspense>
  )
}

function NewApplicationContent() {
  const { user } = useUser()
  const profile = useQuery(
    api.resumeProfiles.getByUser,
    user ? { userId: user.sub! } : "skip"
  )
  const searchParams = useSearchParams()

  const STORAGE_KEY = "autoapply_draft"

  const [step, setStep] = useState<Step>("input")
  const [jobDescription, setJobDescription] = useState("")
  const [company, setCompany] = useState("")
  const [role, setRole] = useState("")
  const [recipientEmail, setRecipientEmail] = useState("")
  const [coverLetter, setCoverLetter] = useState("")
  const [isExtracting, setIsExtracting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [showStepUp, setShowStepUp] = useState(false)
  const [error, setError] = useState("")
  const [restored, setRestored] = useState(false)

  // Restore saved draft from sessionStorage on mount (survives step-up auth redirect)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw)
        if (saved.step) setStep(saved.step)
        if (saved.jobDescription) setJobDescription(saved.jobDescription)
        if (saved.company) setCompany(saved.company)
        if (saved.role) setRole(saved.role)
        if (saved.recipientEmail) setRecipientEmail(saved.recipientEmail)
        if (saved.coverLetter) setCoverLetter(saved.coverLetter)
      }
    } catch {
      // Ignore parse errors
    }
    setRestored(true)
  }, [])

  // Save draft to sessionStorage whenever form data changes
  useEffect(() => {
    if (!restored) return
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      step, jobDescription, company, role, recipientEmail, coverLetter,
    }))
  }, [restored, step, jobDescription, company, role, recipientEmail, coverLetter])

  // Check if we returned from step-up auth — send directly from sessionStorage
  // (React state may not be updated yet when this runs)
  const steppedUp = searchParams.get("stepped_up") === "true"
  useEffect(() => {
    if (!restored || !steppedUp || !user) return

    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw)
      if (!saved.coverLetter || !saved.company || !saved.recipientEmail) return

      setIsSending(true)
      const subject = `Application for ${saved.role} — ${user.name || "Applicant"}`
      fetch("/api/send-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: saved.recipientEmail,
          subject,
          body: saved.coverLetter,
          company: saved.company,
          role: saved.role,
          coverLetter: saved.coverLetter,
        }),
      })
        .then(async (res) => {
          const data = await res.json()
          if (data.requiresStepUp) {
            setError("Step-up auth did not refresh session. Please try again.")
            return
          }
          if (!res.ok) {
            setError(data.error || data.detail || "Send failed.")
            return
          }
          sessionStorage.removeItem(STORAGE_KEY)
          setStep("sent")
        })
        .catch((err) => setError(`Network error: ${err.message}`))
        .finally(() => setIsSending(false))
    } catch {
      // Ignore
    }
  }, [restored, steppedUp, user])

  const hasProfile = profile && profile.skills.length > 0

  const handleExtract = async () => {
    if (jobDescription.trim().length < 50) {
      setError("Paste a job description first (at least a few sentences).")
      return
    }

    setIsExtracting(true)
    setError("")
    try {
      const res = await fetch("/api/extract-job-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.company) setCompany(data.company)
        if (data.role) setRole(data.role)
        if (data.email) setRecipientEmail(data.email)
      }
    } catch {
      setError("Failed to extract job info. Fill in the fields manually.")
    } finally {
      setIsExtracting(false)
    }
  }

  const handleGenerate = async () => {
    if (!jobDescription.trim() || !company.trim() || !role.trim()) {
      setError("Please fill in company, role, and job description.")
      return
    }

    setError("")
    setIsGenerating(true)

    try {
      const res = await fetch("/api/generate-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription, company, role }),
      })

      if (!res.ok) {
        const err = await res.json()
        setError(err.error || "Failed to generate cover letter.")
        return
      }

      const data = await res.json()
      setCoverLetter(data.coverLetter)
      setStep("preview")
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSend = async () => {
    if (!recipientEmail.trim()) {
      setError("Please enter the recipient email before sending.")
      return
    }

    setError("")
    setIsSending(true)

    try {
      const subject = `Application for ${role} — ${user?.name || "Applicant"}`
      const res = await fetch("/api/send-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: recipientEmail,
          subject,
          body: coverLetter,
          company,
          role,
          coverLetter,
        }),
      })

      const data = await res.json()

      if (data.requiresStepUp) {
        setShowStepUp(true)
        setIsSending(false)
        return
      }

      if (!res.ok) {
        setError(data.error || "Send failed.")
        setIsSending(false)
        return
      }

      sessionStorage.removeItem(STORAGE_KEY)
      setStep("sent")
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setIsSending(false)
    }
  }

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link
        href="/dashboard"
        className="group mb-8 inline-flex items-center gap-2 text-sm font-semibold text-gray-500 transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
        Back to Dashboard
      </Link>

      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-3">
        {(["input", "preview", "sent"] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-3">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                step === s
                  ? "bg-primary text-white"
                  : i < ["input", "preview", "sent"].indexOf(step)
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-400"
              }`}
            >
              {i < ["input", "preview", "sent"].indexOf(step) ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                i + 1
              )}
            </div>
            {i < 2 && (
              <div
                className={`h-0.5 w-8 rounded ${
                  i < ["input", "preview", "sent"].indexOf(step)
                    ? "bg-green-200"
                    : "bg-gray-100"
                }`}
              />
            )}
          </div>
        ))}
        <span className="ml-2 text-sm font-medium text-gray-500">
          {step === "input"
            ? "Job Details"
            : step === "preview"
              ? "Review & Send"
              : "Sent!"}
        </span>
      </div>

      {!hasProfile && (
        <div className="mb-6 flex gap-3 rounded-xl border border-amber-100 bg-amber-50 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-bold text-amber-900">
              No resume profile found
            </p>
            <p className="mt-0.5 text-xs text-amber-800">
              <Link
                href="/dashboard/resume"
                className="font-bold underline"
              >
                Upload your CV
              </Link>{" "}
              first so the AI can generate personalised cover letters.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 flex gap-3 rounded-xl border border-red-100 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Step 1: Job Description Input */}
      {step === "input" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h1 className="mb-6 font-display text-2xl font-bold text-primary">
              New Application
            </h1>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Job Description
                </label>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the full job description here..."
                  rows={10}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm leading-relaxed transition-colors focus:border-primary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleExtract}
                  disabled={isExtracting || jobDescription.trim().length < 50}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-primary/20 px-3 py-1.5 text-xs font-semibold text-primary transition-all hover:bg-primary/5 disabled:opacity-40"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Detecting...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-3.5 w-3.5" />
                      Auto-detect company, role & email
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">
                    Company
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder={isExtracting ? "Detecting..." : "e.g. Stripe"}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm transition-colors focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">
                    Role
                  </label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder={isExtracting ? "Detecting..." : "e.g. Senior Frontend Engineer"}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm transition-colors focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !hasProfile || isExtracting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Generating Cover Letter...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Generate Cover Letter with AI
              </>
            )}
          </button>
        </div>
      )}

      {/* Step 2: Preview & Edit Cover Letter + Send */}
      {step === "preview" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-50 p-6">
              <div>
                <h2 className="font-display text-xl font-bold text-primary">
                  Cover Letter Preview
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {company} — {role}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Pencil className="h-3 w-3" />
                Click to edit
              </div>
            </div>

            <div className="p-6">
              <textarea
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                rows={12}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm leading-relaxed transition-colors focus:border-primary focus:outline-none"
              />
            </div>

            <div className="border-t border-gray-50 p-6">
              <label className="mb-1 block text-sm font-semibold text-gray-700">
                Recipient Email
              </label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="e.g. hiring@stripe.com"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm transition-colors focus:border-primary focus:outline-none"
              />
              {!recipientEmail && (
                <p className="mt-1.5 text-xs text-gray-400">
                  Enter the recruiter or hiring manager&apos;s email to send your application.
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep("input")}
              className="flex-1 rounded-xl border border-gray-200 px-6 py-4 text-sm font-bold text-gray-600 transition-all hover:bg-gray-50"
            >
              Back to Edit
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="flex items-center gap-2 rounded-xl border border-primary/20 px-6 py-4 text-sm font-bold text-primary transition-all hover:bg-primary/5"
            >
              <Sparkles className="h-4 w-4" />
              Regenerate
            </button>
            <button
              onClick={handleSend}
              disabled={isSending || !recipientEmail.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Application
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Success */}
      {step === "sent" && (
        <div className="rounded-2xl border border-gray-100 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-50">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>
          <h2 className="mb-2 font-display text-2xl font-bold text-primary">
            Application Sent!
          </h2>
          <p className="mb-2 text-gray-500">
            Your cover letter for <strong>{role}</strong> at{" "}
            <strong>{company}</strong> has been sent via Gmail.
          </p>
          <p className="mb-8 text-sm text-gray-400">
            The agent will monitor your inbox for recruiter replies and
            auto-update your tracker.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              href="/dashboard/new"
              onClick={() => {
                sessionStorage.removeItem(STORAGE_KEY)
                setStep("input")
                setJobDescription("")
                setCompany("")
                setRole("")
                setRecipientEmail("")
                setCoverLetter("")
              }}
              className="rounded-xl border border-gray-200 px-6 py-3 text-sm font-bold text-gray-600 transition-all hover:bg-gray-50"
            >
              Apply to Another
            </Link>
            <Link
              href="/dashboard"
              className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5"
            >
              View Tracker
            </Link>
          </div>
        </div>
      )}

      <StepUpModal
        isOpen={showStepUp}
        onClose={() => setShowStepUp(false)}
        onAuthenticated={handleSend}
      />
    </div>
  )
}
