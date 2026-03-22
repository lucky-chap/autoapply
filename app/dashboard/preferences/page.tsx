"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import {
  Settings2,
  Save,
  Loader2,
  ArrowLeft,
  Plus,
  X,
  MapPin,
  Briefcase,
  CircleDollarSign,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"
import Link from "next/link"

export default function PreferencesPage() {
  // In a real app, we'd get the userId from Auth0 session on the server
  // and pass it down, or use a hook. For now, we'll assume the session is handled.
  // Since this is a client component, we'll need the userId.
  // We'll mock it for now or assume it's available.
  // TODO: Get actual userId from Auth0
  const userId = "user_placeholder"

  const existingPreferences = useQuery(api.preferences.getByUser, { userId })
  const upsertPreferences = useMutation(api.preferences.upsert)

  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle")
  const [roles, setRoles] = useState<string[]>([])
  const [locations, setLocations] = useState<string[]>([])
  const [minSalary, setMinSalary] = useState<number | "">("")

  useEffect(() => {
    if (existingPreferences) {
      setRoles(existingPreferences.targetRoles)
      setLocations(existingPreferences.targetLocations)
      setMinSalary(existingPreferences.minSalary || "")
    }
  }, [existingPreferences])

  const handleSave = async () => {
    try {
      setIsSaving(true)
      setSaveStatus("idle")
      await upsertPreferences({
        userId,
        targetRoles: roles,
        targetLocations: locations,
        minSalary: minSalary === "" ? undefined : Number(minSalary),
      })
      setSaveStatus("saved")
      setTimeout(() => setSaveStatus("idle"), 3000)
    } catch (error) {
      console.error("Save failed:", error)
      setSaveStatus("error")
      setTimeout(() => setSaveStatus("idle"), 4000)
    } finally {
      setIsSaving(false)
    }
  }

  const addRole = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && e.currentTarget.value) {
      if (!roles.includes(e.currentTarget.value)) {
        setRoles([...roles, e.currentTarget.value])
      }
      e.currentTarget.value = ""
    }
  }

  const addLocation = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && e.currentTarget.value) {
      if (!locations.includes(e.currentTarget.value)) {
        setLocations([...locations, e.currentTarget.value])
      }
      e.currentTarget.value = ""
    }
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

      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary">
            Job Preferences
          </h1>
          <p className="mt-2 text-gray-500">
            Tell the agent what you're looking for to get the best matches.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1.5 text-sm font-semibold text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              Saved
            </span>
          )}
          {saveStatus === "error" && (
            <span className="flex items-center gap-1.5 text-sm font-semibold text-red-500">
              <AlertCircle className="h-4 w-4" />
              Failed to save
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="space-y-8">
        <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Briefcase className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-bold text-primary">Target Roles</h2>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
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
              type="text"
              placeholder="Add role (e.g. Senior Frontend Engineer) and press Enter"
              onKeyDown={addRole}
              className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm focus:border-blue-200 focus:bg-white focus:outline-hidden"
            />
          </div>
        </section>

        <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-600">
              <MapPin className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-bold text-primary">Target Locations</h2>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
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
              type="text"
              placeholder="Add location (e.g. Remote, New York) and press Enter"
              onKeyDown={addLocation}
              className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm focus:border-green-200 focus:bg-white focus:outline-hidden"
            />
          </div>
        </section>

        <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <CircleDollarSign className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-bold text-primary">
              Minimum Annual Salary
            </h2>
          </div>

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
        </section>
      </div>

      <div className="mt-8 flex gap-4 rounded-2xl border border-amber-100 bg-amber-50 p-6">
        <Settings2 className="h-6 w-6 shrink-0 text-amber-600" />
        <p className="text-sm leading-relaxed text-amber-900">
          Your preferences help our AI agent filter out irrelevant job posts and
          focus on high-quality matches that fit your career goals.
        </p>
      </div>
    </div>
  )
}
