import { auth0 } from "@/lib/auth0"
import { redirect } from "next/navigation"
import Link from "next/link"
import {
  LayoutDashboard,
  FileText,
  ShieldCheck,
  Plus,
  Settings2,
} from "lucide-react"
import {
  ApplicationsTable,
  CheckInboxButton,
} from "@/components/DashboardClient"
import { ResumeProfileBox } from "@/components/ResumeProfileBox"
import { PendingActions } from "@/components/PendingActions"
import { TelegramLinkCard } from "@/components/TelegramLinkCard"
import { TelegramLinkedDialog } from "@/components/TelegramLinkedDialog"

export default async function DashboardPage() {
  const session = await auth0.getSession()
  if (!session) {
    redirect("/auth/login")
  }

  const user = session.user

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <TelegramLinkedDialog />
      {/* Header */}
      <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary">
            Welcome back, {user.name?.split(" ")[0]}
          </h1>
          <p className="mt-1 text-gray-500">
            Your AI career agent is ready to help you land your next role.
          </p>
        </div>
        <Link
          href="/dashboard/new"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-semibold text-white shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-95"
        >
          <Plus className="h-5 w-5" />
          New Application
        </Link>
      </div>

      {/* Main Content Areas */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column: Recent Activity / Resume */}
        <div className="space-y-8 lg:col-span-2">
          <ResumeProfileBox userId={user.sub} />

          <PendingActions userId={user.sub} />

          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-50 p-6">
              <h2 className="font-display text-xl font-bold text-primary">
                Applications
              </h2>
            </div>
            <div className="p-4">
              <ApplicationsTable userId={user.sub} />
            </div>
          </section>
        </div>

        {/* Right Column: Quick Links & Help */}
        <div className="space-y-6">
          <div className="to-primary-focus rounded-2xl bg-linear-to-br from-primary p-6 text-white shadow-xl shadow-primary/10">
            <h3 className="mb-2 text-lg font-bold">Pro Tip</h3>
            <p className="mb-4 text-sm leading-relaxed text-white/80">
              AutoApply works best when you provide the full job description.
              The agent will match your skills precisely.
            </p>
            <div className="h-1 w-12 rounded-full bg-secondary"></div>
          </div>

          <CheckInboxButton />

          <TelegramLinkCard userId={user.sub} />

          <nav className="space-y-1 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 rounded-xl bg-gray-50 p-3 font-semibold text-primary transition-all"
            >
              <LayoutDashboard className="h-5 w-5" />
              Overview
            </Link>
            <Link
              href="/dashboard/resume"
              className="flex items-center gap-3 rounded-xl p-3 text-gray-600 transition-all hover:bg-gray-50 hover:text-primary"
            >
              <FileText className="h-5 w-5" />
              Resume Profile
            </Link>
            <Link
              href="/dashboard/preferences"
              className="flex items-center gap-3 rounded-xl p-3 text-gray-600 transition-all hover:bg-gray-50 hover:text-primary"
            >
              <Settings2 className="h-5 w-5" />
              Job Preferences
            </Link>
            <Link
              href="/permissions"
              className="flex items-center gap-3 rounded-xl p-3 text-gray-600 transition-all hover:bg-gray-50 hover:text-primary"
            >
              <ShieldCheck className="h-5 w-5" />
              Security & Permissions
            </Link>
          </nav>

          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
            <div className="flex gap-3">
              <ShieldCheck className="h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-bold text-amber-900">
                  Step-Up Auth Active
                </p>
                <p className="mt-0.5 text-xs text-amber-800">
                  We'll ask for MFA confirmation before sending any email via
                  Gmail.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
