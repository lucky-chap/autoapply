"use client"

import { useState, useRef } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useRouter } from "next/navigation"
import { UploadResume } from "./UploadResume"
import {
  ArrowRight,
  ArrowLeft,
  Sparkles,
  FileText,
  Briefcase,
  Shield,
  CheckCircle2,
  Loader2,
  X,
} from "lucide-react"

const STEPS = [
  { id: "welcome", label: "Welcome" },
  { id: "resume", label: "Resume" },
  { id: "preferences", label: "Preferences" },
  { id: "google", label: "Connect Google" },
  { id: "done", label: "Done" },
] as const

type StepId = (typeof STEPS)[number]["id"]

export function OnboardingWizard({
  userId,
  userName,
  isGoogleConnected,
}: {
  userId: string
  userName: string
  isGoogleConnected: boolean
}) {
  const router = useRouter()
  const [step, setStep] = useState<StepId>("welcome")
  const resumeProfile = useQuery(api.resumeProfiles.getByUser, { userId })
  const preferences = useQuery(api.preferences.getByUser, { userId })
  const completeOnboarding = useMutation(api.userSettings.completeOnboarding)

  const currentIndex = STEPS.findIndex((s) => s.id === step)

  const goNext = () => {
    const nextIndex = currentIndex + 1
    if (nextIndex < STEPS.length) {
      setStep(STEPS[nextIndex].id)
    }
  }

  const goBack = () => {
    const prevIndex = currentIndex - 1
    if (prevIndex >= 0) {
      setStep(STEPS[prevIndex].id)
    }
  }

  const handleComplete = async () => {
    await completeOnboarding({ userId })
    router.push("/dashboard")
  }

  const hasResume = !!resumeProfile?.skills?.length
  const hasPreferences =
    (preferences?.targetRoles?.length ?? 0) > 0 ||
    (preferences?.targetLocations?.length ?? 0) > 0

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      {/* Progress bar */}
      <div className="mb-10">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                  i < currentIndex
                    ? "bg-green-500 text-white"
                    : i === currentIndex
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {i < currentIndex ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`mx-2 h-0.5 w-8 sm:w-16 ${
                    i < currentIndex ? "bg-green-500" : "bg-gray-100"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-sm font-semibold text-gray-500">
          Step {currentIndex + 1} of {STEPS.length} &mdash;{" "}
          {STEPS[currentIndex].label}
        </p>
      </div>

      {/* Step content */}
      {step === "welcome" && (
        <WelcomeStep userName={userName} onNext={goNext} />
      )}
      {step === "resume" && (
        <ResumeStep
          userId={userId}
          hasResume={hasResume}
          onNext={goNext}
          onBack={goBack}
        />
      )}
      {step === "preferences" && (
        <PreferencesStep
          userId={userId}
          preferences={preferences}
          onNext={goNext}
          onBack={goBack}
        />
      )}
      {step === "google" && <GoogleStep isConnected={isGoogleConnected} onNext={goNext} onBack={goBack} />}
      {step === "done" && <DoneStep onComplete={handleComplete} />}
    </div>
  )
}

function WelcomeStep({
  userName,
  onNext,
}: {
  userName: string
  onNext: () => void
}) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <Sparkles className="h-8 w-8 text-primary" />
      </div>
      <h1 className="font-display text-3xl font-bold text-primary">
        Welcome{userName ? `, ${userName.split(" ")[0]}` : ""}!
      </h1>
      <p className="mx-auto mt-4 max-w-md text-gray-500">
        Let&apos;s set up your AutoApply profile so the agent can start sending
        personalized applications on your behalf.
      </p>
      <p className="mt-2 text-sm text-gray-400">This takes about 2 minutes.</p>
      <button
        onClick={onNext}
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 active:scale-95"
      >
        Get Started
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  )
}

function ResumeStep({
  userId,
  hasResume,
  onNext,
  onBack,
}: {
  userId: string
  hasResume: boolean
  onNext: () => void
  onBack: () => void
}) {
  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-primary">Upload Your Resume</h2>
          <p className="text-sm text-gray-500">
            The agent uses this to write personalized cover letters.
          </p>
        </div>
      </div>

      <UploadResume userId={userId} />

      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-gray-500 transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!hasResume}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
      {!hasResume && (
        <p className="mt-3 text-right text-xs text-amber-600">
          Please upload your resume to continue.
        </p>
      )}
    </div>
  )
}

function PreferencesStep({
  userId,
  preferences,
  onNext,
  onBack,
}: {
  userId: string
  preferences:
    | { targetRoles: string[]; targetLocations: string[]; minSalary?: number }
    | null
    | undefined
  onNext: () => void
  onBack: () => void
}) {
  const upsertPreferences = useMutation(api.preferences.upsert)
  const [roles, setRoles] = useState<string[]>(preferences?.targetRoles ?? [])
  const [locations, setLocations] = useState<string[]>(
    preferences?.targetLocations ?? []
  )
  const [minSalary, setMinSalary] = useState<number | "">(
    preferences?.minSalary ?? ""
  )
  const [isSaving, setIsSaving] = useState(false)
  const roleInputRef = useRef<HTMLInputElement>(null)
  const locationInputRef = useRef<HTMLInputElement>(null)

  const handleSaveAndContinue = async () => {
    // Auto-add any text still in the input fields
    const finalRoles = [...roles]
    const finalLocations = [...locations]
    const pendingRole = roleInputRef.current?.value.trim()
    if (pendingRole && !finalRoles.includes(pendingRole)) {
      finalRoles.push(pendingRole)
      setRoles(finalRoles)
      roleInputRef.current!.value = ""
    }
    const pendingLocation = locationInputRef.current?.value.trim()
    if (pendingLocation && !finalLocations.includes(pendingLocation)) {
      finalLocations.push(pendingLocation)
      setLocations(finalLocations)
      locationInputRef.current!.value = ""
    }

    if (finalRoles.length === 0 && finalLocations.length === 0) return

    setIsSaving(true)
    try {
      await upsertPreferences({
        userId,
        targetRoles: finalRoles,
        targetLocations: finalLocations,
        minSalary: minSalary === "" ? undefined : Number(minSalary),
      })
      onNext()
    } finally {
      setIsSaving(false)
    }
  }

  const processInput = (
    raw: string,
    existing: string[],
    setItems: (items: string[]) => void,
    setInputValue: (val: string) => void,
    inputRef: React.RefObject<HTMLInputElement | null>
  ) => {
    const parts = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    if (parts.length === 0) return
    const updated = [...existing]
    for (const part of parts) {
      if (!updated.includes(part)) updated.push(part)
    }
    setItems(updated)
    setInputValue("")
    if (inputRef.current) inputRef.current.value = ""
  }

  const handleRoleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      processInput(
        e.currentTarget.value,
        roles,
        setRoles,
        setRoleInputValue,
        roleInputRef
      )
    }
  }

  const handleRoleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    // If they typed or pasted a comma, process immediately
    if (val.includes(",")) {
      processInput(val, roles, setRoles, setRoleInputValue, roleInputRef)
    } else {
      setRoleInputValue(val)
    }
  }

  const handleLocationKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      processInput(
        e.currentTarget.value,
        locations,
        setLocations,
        setLocationInputValue,
        locationInputRef
      )
    }
  }

  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val.includes(",")) {
      processInput(
        val,
        locations,
        setLocations,
        setLocationInputValue,
        locationInputRef
      )
    } else {
      setLocationInputValue(val)
    }
  }

  const [roleInputValue, setRoleInputValue] = useState("")
  const [locationInputValue, setLocationInputValue] = useState("")
  const hasAnyPrefs =
    roles.length > 0 ||
    locations.length > 0 ||
    roleInputValue.trim().length > 0 ||
    locationInputValue.trim().length > 0

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-600">
          <Briefcase className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-primary">Job Preferences</h2>
          <p className="text-sm text-gray-500">
            Help the agent target the right opportunities.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-700">
            Target Roles
          </label>
          <div className="mb-2 flex flex-wrap gap-2">
            {roles.map((role) => (
              <span
                key={role}
                className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700"
              >
                {role}
                <button
                  onClick={() => setRoles(roles.filter((r) => r !== role))}
                  className="rounded-full p-0.5 hover:bg-blue-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <input
            ref={roleInputRef}
            type="text"
            placeholder="e.g. Senior Frontend Engineer (Enter or comma to add)"
            onKeyDown={handleRoleKeyDown}
            onChange={handleRoleChange}
            value={roleInputValue}
            className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm focus:border-blue-200 focus:bg-white focus:outline-hidden"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-700">
            Target Locations
          </label>
          <div className="mb-2 flex flex-wrap gap-2">
            {locations.map((loc) => (
              <span
                key={loc}
                className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-sm font-semibold text-green-700"
              >
                {loc}
                <button
                  onClick={() =>
                    setLocations(locations.filter((l) => l !== loc))
                  }
                  className="rounded-full p-0.5 hover:bg-green-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <input
            ref={locationInputRef}
            type="text"
            placeholder="e.g. Remote, New York (Enter or comma to add)"
            onKeyDown={handleLocationKeyDown}
            onChange={handleLocationChange}
            value={locationInputValue}
            className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm focus:border-green-200 focus:bg-white focus:outline-hidden"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-700">
            Minimum Annual Salary (optional)
          </label>
          <div className="relative">
            <span className="absolute top-1/2 left-4 -translate-y-1/2 font-bold text-gray-400">
              $
            </span>
            <input
              type="number"
              value={minSalary}
              onChange={(e) =>
                setMinSalary(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
              placeholder="e.g. 120000"
              className="w-full rounded-xl border border-gray-100 bg-gray-50 py-3 pr-4 pl-8 text-sm focus:border-amber-200 focus:bg-white focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-gray-500 transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          onClick={handleSaveAndContinue}
          disabled={!hasAnyPrefs || isSaving}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Save & Continue
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
      {!hasAnyPrefs && (
        <p className="mt-3 text-right text-xs text-amber-600">
          Add at least one target role or location to continue.
        </p>
      )}
    </div>
  )
}

function GoogleStep({
  isConnected,
  onNext,
  onBack,
}: {
  isConnected: boolean
  onNext: () => void
  onBack: () => void
}) {
  const scopes = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/calendar.events",
  ]
  const scopeParams = scopes
    .map((s) => `scopes=${encodeURIComponent(s)}`)
    .join("&")
  const connectUrl = `/auth/connect?connection=google-oauth2&prompt=consent&${scopeParams}&returnTo=${encodeURIComponent("/onboarding")}`

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isConnected ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"}`}>
          {isConnected ? <CheckCircle2 className="h-5 w-5" /> : <Shield className="h-5 w-5" />}
        </div>
        <div>
          <h2 className="text-xl font-bold text-primary">
            {isConnected ? "Google Connected" : "Connect Google"}
          </h2>
          <p className="text-sm text-gray-500">
            {isConnected
              ? "Your Google account is connected. Gmail and Calendar access is ready."
              : "Grant Gmail and Calendar access so the agent can send emails and check availability."}
          </p>
        </div>
      </div>

      <div className={`rounded-2xl border p-6 ${isConnected ? "border-green-100 bg-green-50/50" : "border-gray-100 bg-gray-50"}`}>
        {isConnected ? (
          <>
            <div className="mb-4 flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <p className="font-semibold text-green-800">All permissions granted</p>
            </div>
            <ul className="space-y-2 text-sm text-green-700">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                <span>Gmail &mdash; Send &amp; Read</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                <span>Google Calendar &mdash; Events</span>
              </li>
            </ul>
            <a
              href={connectUrl}
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
            >
              <Shield className="h-4 w-4" />
              Re-authorize
            </a>
          </>
        ) : (
          <>
            <p className="mb-4 text-sm text-gray-600">
              AutoApply needs access to your Google account to:
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                <span>
                  <strong>Send emails</strong> from your Gmail account
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                <span>
                  <strong>Read replies</strong> to detect recruiter responses
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                <span>
                  <strong>Check calendar</strong> for interview availability
                </span>
              </li>
            </ul>
            <a
              href={connectUrl}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 active:scale-95"
            >
              <Shield className="h-4 w-4" />
              Connect Google Account
            </a>
            <p className="mt-3 text-xs text-gray-400">
              You&apos;ll be redirected to Google&apos;s consent screen to grant
              permissions.
            </p>
          </>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-gray-500 transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 active:scale-95"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function DoneStep({ onComplete }: { onComplete: () => void }) {
  const [isCompleting, setIsCompleting] = useState(false)

  const handleComplete = async () => {
    setIsCompleting(true)
    onComplete()
  }

  return (
    <div className="text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50">
        <CheckCircle2 className="h-8 w-8 text-green-500" />
      </div>
      <h2 className="font-display text-3xl font-bold text-primary">
        You&apos;re all set!
      </h2>
      <p className="mx-auto mt-4 max-w-md text-gray-500">
        Your profile is ready. Head to the dashboard to start applying to jobs
        or link your Telegram account for mobile-friendly applications.
      </p>
      <button
        onClick={handleComplete}
        disabled={isCompleting}
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
      >
        {isCompleting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            Go to Dashboard
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </div>
  )
}
