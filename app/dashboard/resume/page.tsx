import { auth0 } from "@/lib/auth0"
import { redirect } from "next/navigation"
import { FileText, Upload, CheckCircle2, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default async function ResumePage() {
  const session = await auth0.getSession()
  if (!session) {
    redirect("/auth/login")
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

      <div className="mb-10">
        <h1 className="font-display text-3xl font-bold text-primary">
          Resume Profile
        </h1>
        <p className="mt-2 text-gray-500">
          Your resume is the blueprint for every cover letter we generate.
        </p>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-gray-200 bg-gray-50">
          <Upload className="h-10 w-10 text-gray-300" />
        </div>

        <h2 className="mb-2 text-xl font-bold text-primary">
          Upload your Latest CV
        </h2>
        <p className="mx-auto mb-8 max-w-sm text-sm leading-relaxed text-gray-500">
          Upload a PDF version of your resume. Our AI agent will parse your
          skills and experience to write hyper-relevant applications.
        </p>

        <div className="flex flex-col items-center gap-4">
          <button className="w-full rounded-2xl bg-primary px-10 py-4 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 active:scale-95 sm:w-auto">
            Select PDF File
          </button>
          <p className="text-xs text-gray-400">
            Supported formats: .pdf (Max 5MB)
          </p>
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-2xl bg-blue-50 p-6">
          <h3 className="mb-2 flex items-center gap-2 font-bold text-blue-900">
            <CheckCircle2 className="h-5 w-5 text-blue-600" />
            AI Parsing
          </h3>
          <p className="text-sm leading-relaxed text-blue-800/80">
            We use GLM-5 to extract structured data from your resume. No manual
            entry required.
          </p>
        </div>
        <div className="rounded-2xl bg-green-50 p-6">
          <h3 className="mb-2 flex items-center gap-2 font-bold text-green-900">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Tone Matching
          </h3>
          <p className="text-sm leading-relaxed text-green-800/80">
            The agent learns your writing style to ensure the AI-drafted letters
            sound exactly like you.
          </p>
        </div>
      </div>
    </div>
  )
}
