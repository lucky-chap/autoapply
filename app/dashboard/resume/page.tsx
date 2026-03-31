import { auth0 } from "@/lib/auth0"
import { redirect } from "next/navigation"
import { FileText, CheckCircle2, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { UploadResume } from "@/components/UploadResume"

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
          Your resume powers every generated application and cover letter.
        </p>
      </div>

      <UploadResume userId={session.user.sub!} />

      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-2xl bg-blue-50 p-6">
          <h3 className="mb-2 flex items-center gap-2 font-bold text-blue-900">
            <CheckCircle2 className="h-5 w-5 text-blue-600" />
            Resume Parsing
          </h3>
          <p className="text-sm leading-relaxed text-blue-800/80">
            We extract structured skills and experience from your resume so
            drafts start with accurate context.
          </p>
        </div>
        <div className="rounded-2xl bg-green-50 p-6">
          <h3 className="mb-2 flex items-center gap-2 font-bold text-green-900">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Role-Aware Personalization
          </h3>
          <p className="text-sm leading-relaxed text-green-800/80">
            Generated letters adapt your experience to each role while keeping
            the tone consistent with your profile.
          </p>
        </div>
      </div>
    </div>
  )
}
