"use client"

import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import {
  Upload,
  CheckCircle2,
  Loader2,
  Sparkles,
  Briefcase,
  Palette,
  Github,
  Linkedin,
  Globe,
} from "lucide-react"

export function UploadResume({ userId }: { userId: string }) {
  const [isUploading, setIsUploading] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [linksSaving, setLinksSaving] = useState(false)
  const [githubUrl, setGithubUrl] = useState("")
  const [linkedinUrl, setLinkedinUrl] = useState("")
  const [portfolioUrl, setPortfolioUrl] = useState("")
  const [linksInitialized, setLinksInitialized] = useState(false)
  const generateUploadUrl = useMutation(api.resumeProfiles.generateUploadUrl)
  const upsertResume = useMutation(api.resumeProfiles.upsert)
  const updateLinks = useMutation(api.resumeProfiles.updateLinks)
  const profile = useQuery(api.resumeProfiles.getByUser, { userId })

  // Initialize link fields from profile once loaded
  if (profile && !linksInitialized) {
    setGithubUrl(profile.githubUrl ?? "")
    setLinkedinUrl(profile.linkedinUrl ?? "")
    setPortfolioUrl(profile.portfolioUrl ?? "")
    setLinksInitialized(true)
  }

  const handleSaveLinks = async () => {
    setLinksSaving(true)
    try {
      await updateLinks({
        userId,
        githubUrl: githubUrl.trim() || undefined,
        linkedinUrl: linkedinUrl.trim() || undefined,
        portfolioUrl: portfolioUrl.trim() || undefined,
      })
    } catch (error) {
      console.error("Failed to save links:", error)
    } finally {
      setLinksSaving(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsUploading(true)

      // 1. Get a short-lived upload URL from Convex
      const postUrl = await generateUploadUrl()

      // 2. Post the file to the URL
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      })

      const { storageId } = await result.json()

      // 3. Save file reference immediately
      await upsertResume({
        userId,
        fileId: storageId,
        skills: [],
        experience: [],
        tone: "Professional",
        rawText: "",
      })

      setIsUploading(false)
      setIsParsing(true)

      // 4. Trigger AI parsing
      const parseRes = await fetch("/api/parse-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: storageId }),
      })

      if (!parseRes.ok) {
        const errText = await parseRes.text()
        try {
          const err = JSON.parse(errText)
          console.error("Parse failed:", err)
        } catch {
          console.error("Parse failed:", errText)
        }
      }
    } catch (error) {
      console.error("Upload failed:", error)
      alert("Upload failed. Please try again.")
    } finally {
      setIsUploading(false)
      setIsParsing(false)
    }
  }

  const hasProfile = profile && profile.skills.length > 0

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-gray-200 bg-gray-50">
          {isUploading ? (
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          ) : isParsing ? (
            <Sparkles className="h-10 w-10 animate-pulse text-secondary" />
          ) : hasProfile ? (
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          ) : (
            <Upload className="h-10 w-10 text-gray-300" />
          )}
        </div>

        <h2 className="mb-2 text-xl font-bold text-primary">
          {isParsing
            ? "AI is parsing your resume..."
            : hasProfile
              ? "Resume Parsed!"
              : "Upload your Latest CV"}
        </h2>
        <p className="mx-auto mb-8 max-w-sm text-sm leading-relaxed text-gray-500">
          {isParsing
            ? "GLM-5 is extracting your skills, experience, and writing tone. This takes a few seconds."
            : hasProfile
              ? "Your profile is ready. The agent will use this for all cover letters."
              : "Upload a PDF version of your resume. Our AI agent will parse your skills and experience."}
        </p>

        <div className="flex flex-col items-center gap-4">
          <label className="relative cursor-pointer">
            <input
              type="file"
              accept=".pdf"
              onChange={handleUpload}
              disabled={isUploading || isParsing}
              className="sr-only"
            />
            <button
              disabled={isUploading || isParsing}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-10 py-4 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {isUploading
                ? "Uploading..."
                : isParsing
                  ? "Parsing..."
                  : hasProfile
                    ? "Re-upload CV"
                    : "Select PDF File"}
            </button>
          </label>
          <p className="text-xs text-gray-400">
            Supported formats: .pdf (Max 5MB)
          </p>
        </div>
      </div>

      {/* Parsed Profile Display */}
      {hasProfile && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-display text-lg font-bold text-primary">
            Extracted Profile
          </h3>

          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Sparkles className="h-4 w-4 text-secondary" />
                Skills
              </div>
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Briefcase className="h-4 w-4 text-secondary" />
                Experience
              </div>
              <div className="space-y-2">
                {profile.experience.map((exp, i) => (
                  <div key={i} className="rounded-lg bg-gray-50 p-3 text-sm">
                    <span className="font-semibold text-primary">
                      {exp.title}
                    </span>{" "}
                    at {exp.company}{" "}
                    <span className="text-gray-400">
                      ({exp.years} {exp.years === 1 ? "year" : "years"})
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Palette className="h-4 w-4 text-secondary" />
                Detected Tone
              </div>
              <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
                {profile.tone}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Profile Links */}
      {hasProfile && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-display text-lg font-bold text-primary">
            Profile Links
          </h3>
          <p className="mb-4 text-sm text-gray-500">
            Optional. When relevant, the AI will include these in your cover
            letters.
          </p>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Github className="h-5 w-5 shrink-0 text-gray-400" />
              <input
                type="url"
                placeholder="https://github.com/username"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex items-center gap-3">
              <Linkedin className="h-5 w-5 shrink-0 text-gray-400" />
              <input
                type="url"
                placeholder="https://linkedin.com/in/username"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 shrink-0 text-gray-400" />
              <input
                type="url"
                placeholder="https://yourportfolio.com"
                value={portfolioUrl}
                onChange={(e) => setPortfolioUrl(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
            <button
              onClick={handleSaveLinks}
              disabled={linksSaving}
              className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
            >
              {linksSaving ? "Saving..." : "Save Links"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
