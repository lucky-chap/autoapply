"use client"

import { useState, useEffect, useRef, Suspense } from "react"
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
  X,
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
  const [applicationId, setApplicationId] = useState<string | null>(null)
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
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        step,
        jobDescription,
        company,
        role,
        recipientEmail,
        coverLetter,
      })
    )
  }, [
    restored,
    step,
    jobDescription,
    company,
    role,
    recipientEmail,
    coverLetter,
  ])

  // Check if we returned from step-up auth — send directly from sessionStorage
  // (React state may not be updated yet when this runs)
  const steppedUp = searchParams.get("stepped_up") === "true"
  const hasSentRef = useRef(false)
  useEffect(() => {
    if (!restored || !steppedUp || !user || hasSentRef.current) return
    hasSentRef.current = true

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
          if (data.applicationId) {
            setApplicationId(data.applicationId)
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

      if (data.applicationId) {
        setApplicationId(data.applicationId)
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

  const steps: Step[] = ["input", "preview", "sent"]
  const activeStepIndex = steps.indexOf(step)
  const jobDescriptionWords = jobDescription.trim()
    ? jobDescription.trim().split(/\s+/).length
    : 0
  const coverLetterWords = coverLetter.trim()
    ? coverLetter.trim().split(/\s+/).length
    : 0
  const readinessScore =
    (jobDescription.trim() ? 1 : 0) +
    (company.trim() ? 1 : 0) +
    (role.trim() ? 1 : 0) +
    (recipientEmail.trim() ? 1 : 0)

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link
              href="/dashboard"
              className="group mb-4 inline-flex items-center gap-2 text-sm font-medium text-black/50 transition-colors hover:text-black"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              Back to Dashboard
            </Link>
            <h1 className="font-display text-4xl font-semibold tracking-tight text-black sm:text-5xl md:leading-[1.1]">
              Create Application
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-black/60 sm:text-base">
              Build, review, and send a tailored job application from one flow.
            </p>
          </div>
          <div className="rounded-full border border-black/15 bg-white/75 px-4 py-2 text-xs font-semibold tracking-[0.08em] text-black/60 uppercase">
            Draft autosaves on this device
          </div>
        </div>

        <div className="mb-6 rounded-3xl border border-black/10 bg-white/80 p-4 backdrop-blur sm:p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {steps.map((s, i) => {
              const complete = i < activeStepIndex
              const active = i === activeStepIndex
              return (
                <div
                  key={s}
                  className={`flex items-center gap-3 rounded-2xl border px-3 py-3 transition-colors ${
                    active
                      ? "border-black/20 bg-black/5"
                      : complete
                        ? "border-black/10 bg-white"
                        : "border-black/5 bg-white"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      active
                        ? "bg-black text-white"
                        : complete
                          ? "bg-black text-white"
                          : "bg-black/5 text-black/40"
                    }`}
                  >
                    {complete ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </div>
                  <div>
                    <p className="text-[11px] tracking-widest text-black/50 uppercase">
                      Step {i + 1}
                    </p>
                    <p className="text-sm font-semibold text-black">
                      {s === "input"
                        ? "Job Details"
                        : s === "preview"
                          ? "Review & Send"
                          : "Complete"}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {!hasProfile && (
          <div className="mb-6 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-bold text-amber-900">
                Resume profile missing
              </p>
              <p className="mt-1 text-xs text-amber-800">
                <Link href="/dashboard/resume" className="font-bold underline">
                  Upload your CV
                </Link>{" "}
                first so generation can personalize to your experience.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/90 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <p className="flex-1 text-sm text-red-700">{error}</p>
            <button
              onClick={() => setError("")}
              className="shrink-0 rounded-full p-0.5 text-red-400 transition-colors hover:bg-red-100 hover:text-red-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-6">
            {step === "input" && (
              <>
                <article className="relative overflow-hidden rounded-2xl border border-black/10 bg-white">
                  <div className="relative border-b border-black/10 p-6">
                    <p className="text-xs font-semibold tracking-widest text-black/50 uppercase">
                      Input
                    </p>
                    <h2 className="mt-2 font-display text-2xl font-semibold text-black">
                      Paste the job post and build the draft
                    </h2>
                  </div>

                  <div className="space-y-5 p-6">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-black/75">
                        Job Description
                      </label>
                      <textarea
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        placeholder="Paste the full job description here..."
                        rows={11}
                        className="w-full rounded-2xl border border-black/15 bg-[#fbfbfa] px-4 py-3 text-base leading-relaxed text-black transition-colors placeholder:text-black/35 focus:border-black/35 focus:outline-none sm:text-sm"
                      />
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-black/50">
                          {jobDescriptionWords} words
                        </span>
                        <button
                          type="button"
                          onClick={handleExtract}
                          disabled={
                            isExtracting || jobDescription.trim().length < 50
                          }
                          className="inline-flex items-center gap-1.5 rounded-full border border-black/20 bg-white px-3 py-1.5 text-xs font-semibold text-black transition-all hover:bg-[#f3f3ef] disabled:opacity-40"
                        >
                          {isExtracting ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Detecting...
                            </>
                          ) : (
                            <>
                              <Wand2 className="h-3.5 w-3.5" />
                              Auto-detect company, role, and recipient email
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-black/75">
                          Company
                        </label>
                        <input
                          type="text"
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                          placeholder={
                            isExtracting ? "Detecting..." : "e.g. Stripe"
                          }
                          className="w-full rounded-2xl border border-black/15 bg-[#fbfbfa] px-4 py-3 text-sm transition-colors focus:border-black/35 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-black/75">
                          Role
                        </label>
                        <input
                          type="text"
                          value={role}
                          onChange={(e) => setRole(e.target.value)}
                          placeholder={
                            isExtracting
                              ? "Detecting..."
                              : "e.g. Senior Frontend Engineer"
                          }
                          className="w-full rounded-2xl border border-black/15 bg-[#fbfbfa] px-4 py-3 text-sm transition-colors focus:border-black/35 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </article>

                {isGenerating ? (
                  <div className="space-y-4 rounded-2xl border border-black/10 bg-white p-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/5">
                        <Sparkles className="h-5 w-5 animate-pulse text-black" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-black">
                          Generating your cover letter...
                        </p>
                        <p className="text-xs text-black/50">
                          Tailoring this application to the role and your
                          profile
                        </p>
                      </div>
                    </div>
                    <div className="animate-pulse space-y-2.5">
                      <div className="h-3.5 w-full rounded bg-black/10" />
                      <div className="h-3.5 w-11/12 rounded bg-black/10" />
                      <div className="h-3.5 w-4/5 rounded bg-black/6" />
                      <div className="h-3.5 w-full rounded bg-black/10" />
                      <div className="h-3.5 w-3/4 rounded bg-black/6" />
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleGenerate}
                    disabled={!hasProfile || isExtracting}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-black px-6 py-4 text-sm font-bold text-white transition-all hover:bg-black/90 disabled:opacity-50"
                  >
                    <Sparkles className="h-5 w-5" />
                    Generate Cover Letter with AI
                  </button>
                )}
              </>
            )}

            {step === "preview" && (
              <>
                <article className="rounded-2xl border border-black/10 bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 p-6">
                    <div>
                      <p className="text-xs font-semibold tracking-widest text-black/50 uppercase">
                        Draft
                      </p>
                      <h2 className="mt-1 font-display text-2xl font-semibold text-black">
                        Review application before sending
                      </h2>
                      <p className="mt-1 text-sm text-black/55">
                        {company || "Company"} - {role || "Role"}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-black/15 bg-[#f7f7f4] px-3 py-1 text-xs font-semibold text-black/60">
                      <Pencil className="h-3 w-3" />
                      Editable draft
                    </span>
                  </div>

                  <div className="p-6">
                    <textarea
                      value={coverLetter}
                      onChange={(e) => setCoverLetter(e.target.value)}
                      rows={13}
                      className="w-full rounded-2xl border border-black/15 bg-[#fbfbfa] px-4 py-3 text-sm leading-relaxed transition-colors focus:border-black/35 focus:outline-none"
                    />
                    <p className="mt-2 text-xs text-black/45">
                      {coverLetterWords} words
                    </p>
                  </div>

                  <div className="border-t border-black/10 p-6">
                    <label className="mb-2 block text-sm font-semibold text-black/75">
                      Recipient Email
                    </label>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="e.g. hiring@stripe.com"
                      className="w-full rounded-2xl border border-black/15 bg-[#fbfbfa] px-4 py-3 text-sm transition-colors focus:border-black/35 focus:outline-none"
                    />
                    {!recipientEmail && (
                      <p className="mt-2 text-xs text-black/45">
                        Enter the recruiter or hiring manager&apos;s email to
                        dispatch this application.
                      </p>
                    )}
                  </div>
                </article>

                <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr]">
                  <button
                    onClick={() => setStep("input")}
                    className="rounded-2xl border border-black/15 bg-white px-6 py-3 text-sm font-semibold text-black/70 transition-colors hover:bg-[#f6f6f2]"
                  >
                    Back to Edit
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-black/20 bg-white px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-[#f6f6f2] disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    Regenerate
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={isSending || !recipientEmail.trim()}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-6 py-3 text-sm font-bold text-white transition-all hover:bg-black/90 disabled:opacity-50"
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send via Gmail
                      </>
                    )}
                  </button>
                </div>
              </>
            )}

            {step === "sent" && (
              <article className="relative overflow-hidden rounded-2xl border border-black/10 bg-white p-10 text-center">
                <div className="relative">
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-black/5">
                    <CheckCircle2 className="h-10 w-10 text-black" />
                  </div>
                  <h2 className="mb-2 font-display text-3xl font-semibold text-black">
                    Application sent
                  </h2>
                  <p className="mx-auto mb-2 max-w-lg text-black/70">
                    Your cover letter for <strong>{role}</strong> at{" "}
                    <strong>{company}</strong> has been sent through Gmail.
                  </p>
                  <p className="mx-auto mb-8 max-w-lg text-sm text-black/50">
                    Inbox monitoring stays active and your tracker timeline will
                    update automatically when recipients engage.
                  </p>
                  <div className="flex flex-col justify-center gap-3 sm:flex-row">
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
                      className="rounded-2xl border border-black/15 bg-white px-6 py-3 text-sm font-semibold text-black/70 transition-colors hover:bg-[#f6f6f2]"
                    >
                      Create another application
                    </Link>
                    <Link
                      href={
                        applicationId
                          ? `/dashboard/tracker/${applicationId}`
                          : "/dashboard"
                      }
                      className="rounded-xl bg-black px-6 py-3 text-sm font-bold text-white transition-all hover:bg-black/90"
                    >
                      View Tracker
                    </Link>
                  </div>
                </div>
              </article>
            )}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <article className="rounded-2xl border border-black/10 bg-white p-5">
              <p className="text-xs font-semibold tracking-widest text-black/50 uppercase">
                Workflow
              </p>
              <div className="mt-3 space-y-2">
                {steps.map((s, i) => {
                  const complete = i < activeStepIndex
                  const active = i === activeStepIndex
                  return (
                    <div
                      key={s}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
                        active
                          ? "bg-black/5"
                          : complete
                            ? "bg-black/5"
                            : "bg-white"
                      }`}
                    >
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                          active
                            ? "bg-black text-white"
                            : complete
                              ? "bg-black text-white"
                              : "bg-black/5 text-black/40"
                        }`}
                      >
                        {complete ? "✓" : i + 1}
                      </div>
                      <span className="text-sm font-medium text-black/75">
                        {s === "input"
                          ? "Add job details"
                          : s === "preview"
                            ? "Review and finalize"
                            : "Track responses"}
                      </span>
                    </div>
                  )
                })}
              </div>
            </article>

            <article className="rounded-2xl border border-black/10 bg-white p-5">
              <p className="text-xs font-semibold tracking-widest text-black/50 uppercase">
                Draft Health
              </p>
              <div className="mt-3 space-y-3">
                <div className="rounded-xl bg-black/5 px-3 py-2">
                  <p className="text-[11px] font-semibold tracking-widest text-black/45 uppercase">
                    Readiness
                  </p>
                  <p className="mt-1 text-lg font-semibold text-black">
                    {readinessScore} / 4 fields ready
                  </p>
                </div>
                <div className="rounded-xl bg-black/5 px-3 py-2">
                  <p className="text-[11px] font-semibold tracking-widest text-black/45 uppercase">
                    Job Description
                  </p>
                  <p className="mt-1 text-sm font-medium text-black/75">
                    {jobDescriptionWords} words pasted
                  </p>
                </div>
                <div className="rounded-xl bg-black/5 px-3 py-2">
                  <p className="text-[11px] font-semibold tracking-widest text-black/45 uppercase">
                    Cover Letter
                  </p>
                  <p className="mt-1 text-sm font-medium text-black/75">
                    {coverLetterWords} words drafted
                  </p>
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-black/10 bg-black/5 p-5 text-black">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-widest text-black/50 uppercase">
                <Sparkles className="h-3.5 w-3.5 text-black/80" />
                Quality Tip
              </p>
              <p className="mt-2 text-sm leading-relaxed text-black/70">
                Cite two exact requirements from the posting in your first
                paragraph, then tie each to one concrete proof point.
              </p>
            </article>
          </aside>
        </div>

        <StepUpModal
          isOpen={showStepUp}
          onClose={() => setShowStepUp(false)}
          onAuthenticated={handleSend}
        />
      </div>
    </div>
  )
}
