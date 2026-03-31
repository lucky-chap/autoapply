"use client"

import { useState, useEffect } from "react"
import { useUser } from "@auth0/nextjs-auth0/client"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import {
  Settings2,
  Save,
  Loader2,
  ArrowLeft,
  X,
  MapPin,
  Briefcase,
  CircleDollarSign,
  CheckCircle2,
  AlertCircle,
  Zap,
  Clock,
  Bell,
} from "lucide-react"
import Link from "next/link"

export default function PreferencesPage() {
  const { user } = useUser()
  const userId = user?.sub

  const existingPreferences = useQuery(
    api.preferences.getByUser,
    userId ? { userId } : "skip"
  )
  const upsertPreferences = useMutation(api.preferences.upsert)
  const userSettings = useQuery(
    api.userSettings.getByUser,
    userId ? { userId } : "skip"
  )
  const toggleAutoMode = useMutation(api.userSettings.toggleAutoMode)
  const updateAvailability = useMutation(api.userSettings.updateAvailability)
  const updateOpenclawSettings = useMutation(api.userSettings.updateOpenclawSettings)

  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle")
  const [roles, setRoles] = useState<string[]>([])
  const [locations, setLocations] = useState<string[]>([])
  const [minSalary, setMinSalary] = useState<number | "">("")
  const [showAutoConfirm, setShowAutoConfirm] = useState(false)

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const DEFAULT_SCHEDULE = DAY_NAMES.map((_, i) => ({
    day: i,
    enabled: i >= 1 && i <= 5, // Mon-Fri enabled
    startHour: 9,
    startMinute: 0,
    endHour: 18,
    endMinute: 0,
  }))

  const [availSchedule, setAvailSchedule] = useState(DEFAULT_SCHEDULE)
  const [availSaving, setAvailSaving] = useState(false)
  const [openclawUrl, setOpenclawUrl] = useState("")
  const [openclawToken, setOpenclawToken] = useState("")
  const [openclawEnabled, setOpenclawEnabled] = useState(false)
  const [openclawSaving, setOpenclawSaving] = useState(false)

  useEffect(() => {
    if (existingPreferences) {
      setRoles(existingPreferences.targetRoles)
      setLocations(existingPreferences.targetLocations)
      setMinSalary(existingPreferences.minSalary || "")
    }
  }, [existingPreferences])

  useEffect(() => {
    if (userSettings?.availabilitySchedule) {
      setAvailSchedule(userSettings.availabilitySchedule)
    }
    if (userSettings) {
      setOpenclawUrl(userSettings.openclawGatewayUrl ?? "")
      setOpenclawToken(userSettings.openclawGatewayToken ?? "")
      setOpenclawEnabled(userSettings.openclawEnabled ?? false)
    }
  }, [userSettings])

  const handleSave = async () => {
    if (!userId) return;
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

  const handleAutoModeToggle = async () => {
    if (!userId) return;
    if (!userSettings?.autoMode) {
      setShowAutoConfirm(true)
      return
    }
    await toggleAutoMode({ userId })
  }

  const handleSaveAvailability = async () => {
    if (!userId) return;
    setAvailSaving(true)
    try {
      await updateAvailability({ userId, availabilitySchedule: availSchedule })
    } finally {
      setAvailSaving(false)
    }
  }

  const updateDaySchedule = (
    dayIndex: number,
    field: string,
    value: boolean | number
  ) => {
    setAvailSchedule((prev) =>
      prev.map((d) => (d.day === dayIndex ? { ...d, [field]: value } : d))
    )
  }

  const handleSaveOpenclaw = async () => {
    if (!userId) return;
    setOpenclawSaving(true)
    try {
      await updateOpenclawSettings({
        userId,
        openclawGatewayUrl: openclawUrl || undefined,
        openclawGatewayToken: openclawToken || undefined,
        openclawEnabled,
      })
    } finally {
      setOpenclawSaving(false)
    }
  }

  const confirmAutoMode = async () => {
    if (!userId) return;
    setShowAutoConfirm(false)
    await toggleAutoMode({ userId })
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

  const isAutoMode = userSettings?.autoMode ?? false

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
            Application Preferences
          </h1>
          <p className="mt-2 text-gray-500">
            Tell AutoApply what to target so it only drafts for relevant roles.
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
        {/* Auto Mode Toggle */}
        <section className={`rounded-3xl border p-5 shadow-sm sm:p-8 ${isAutoMode ? "border-violet-200 bg-violet-50/50" : "border-gray-100 bg-white"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isAutoMode ? "bg-violet-100 text-violet-600" : "bg-gray-100 text-gray-500"}`}>
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-primary">Auto Mode</h2>
                <p className="text-sm text-gray-500">
                  {isAutoMode
                    ? "Applications send automatically without manual approval"
                    : "Keep manual approval before each send"}
                </p>
              </div>
            </div>
            <button
              onClick={handleAutoModeToggle}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${isAutoMode ? "bg-violet-600" : "bg-gray-200"}`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 translate-y-1 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${isAutoMode ? "translate-x-6" : "translate-x-1"}`}
              />
            </button>
          </div>
        </section>

        {/* Confirmation Dialog */}
        {showAutoConfirm && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="mb-4 text-sm font-semibold text-red-800">
              Are you sure you want to enable Auto Mode?
            </p>
            <p className="mb-4 text-sm text-red-700">
              When enabled, the agent will generate cover letters and send
              applications via your Gmail <strong>immediately</strong> without
              asking for your approval. Follow-up emails will also be sent
              automatically.
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmAutoMode}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-red-700"
              >
                Yes, enable Auto Mode
              </button>
              <button
                onClick={() => setShowAutoConfirm(false)}
                className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-gray-700 ring-1 ring-gray-200 transition-all hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

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

        {/* Availability Schedule */}
        <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-primary">
                  Default Availability
                </h2>
                <p className="text-sm text-gray-500">
                  Set your available hours for interview coordination.
                </p>
              </div>
            </div>
            <button
              onClick={handleSaveAvailability}
              disabled={availSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-indigo-700 disabled:opacity-50"
            >
              {availSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save
            </button>
          </div>

          <div className="space-y-3">
            {availSchedule.map((day) => (
              <div
                key={day.day}
                className={`flex items-center gap-4 rounded-xl border px-4 py-3 ${
                  day.enabled
                    ? "border-indigo-100 bg-indigo-50/30"
                    : "border-gray-50 bg-gray-50/50"
                }`}
              >
                <button
                  onClick={() =>
                    updateDaySchedule(day.day, "enabled", !day.enabled)
                  }
                  className={`w-12 text-sm font-bold ${
                    day.enabled ? "text-indigo-700" : "text-gray-400"
                  }`}
                >
                  {DAY_NAMES[day.day]}
                </button>
                <label className="flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={day.enabled}
                    onChange={(e) =>
                      updateDaySchedule(day.day, "enabled", e.target.checked)
                    }
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </label>
                {day.enabled && (
                  <div className="flex items-center gap-2 text-sm">
                    <select
                      value={`${day.startHour}:${day.startMinute.toString().padStart(2, "0")}`}
                      onChange={(e) => {
                        const [h, m] = e.target.value.split(":").map(Number)
                        updateDaySchedule(day.day, "startHour", h)
                        updateDaySchedule(day.day, "startMinute", m)
                      }}
                      className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:border-indigo-300 focus:outline-hidden"
                    >
                      {Array.from({ length: 48 }, (_, i) => {
                        const h = Math.floor(i / 2)
                        const m = (i % 2) * 30
                        const label = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
                        return (
                          <option key={label} value={`${h}:${m.toString().padStart(2, "0")}`}>
                            {label}
                          </option>
                        )
                      })}
                    </select>
                    <span className="text-gray-400">to</span>
                    <select
                      value={`${day.endHour}:${day.endMinute.toString().padStart(2, "0")}`}
                      onChange={(e) => {
                        const [h, m] = e.target.value.split(":").map(Number)
                        updateDaySchedule(day.day, "endHour", h)
                        updateDaySchedule(day.day, "endMinute", m)
                      }}
                      className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:border-indigo-300 focus:outline-hidden"
                    >
                      {Array.from({ length: 48 }, (_, i) => {
                        const h = Math.floor(i / 2)
                        const m = (i % 2) * 30
                        const label = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
                        return (
                          <option key={label} value={`${h}:${m.toString().padStart(2, "0")}`}>
                            {label}
                          </option>
                        )
                      })}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Push Notifications */}
        <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${openclawEnabled ? "bg-teal-50 text-teal-600" : "bg-gray-100 text-gray-500"}`}>
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-primary">Push Notifications</h2>
                <p className="text-sm text-gray-500">
                  Receive push updates when application activity changes.
                </p>
              </div>
            </div>
            <button
              onClick={handleSaveOpenclaw}
              disabled={openclawSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-teal-700 disabled:opacity-50"
            >
              {openclawSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-700">Enable notifications</label>
              <button
                onClick={() => setOpenclawEnabled(!openclawEnabled)}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${openclawEnabled ? "bg-teal-600" : "bg-gray-200"}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 translate-y-1 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${openclawEnabled ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                Gateway URL
              </label>
              <input
                type="url"
                value={openclawUrl}
                onChange={(e) => setOpenclawUrl(e.target.value)}
                placeholder="https://my-openclaw.example.com"
                className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm focus:border-teal-200 focus:bg-white focus:outline-hidden"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                Gateway Token
              </label>
              <input
                type="password"
                value={openclawToken}
                onChange={(e) => setOpenclawToken(e.target.value)}
                placeholder="Your gateway bearer token"
                className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm focus:border-teal-200 focus:bg-white focus:outline-hidden"
              />
            </div>
          </div>
        </section>
      </div>

      <div className="mt-8 flex gap-4 rounded-2xl border border-amber-100 bg-amber-50 p-6">
        <Settings2 className="h-6 w-6 shrink-0 text-amber-600" />
        <p className="text-sm leading-relaxed text-amber-900">
          These preferences guide AutoApply to prioritize strong-fit openings and
          avoid generating low-relevance applications.
        </p>
      </div>
    </div>
  )
}
