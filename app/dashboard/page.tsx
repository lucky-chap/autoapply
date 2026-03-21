import { auth0 } from "@/lib/auth0"
import { redirect } from "next/navigation"
import Link from "next/link"
import {
  LayoutDashboard,
  FileText,
  ShieldCheck,
  Plus,
  Search,
  Mail,
  Clock,
  ArrowUpRight,
} from "lucide-react"

export default async function DashboardPage() {
  const session = await auth0.getSession()
  if (!session) {
    redirect("/auth/login")
  }

  const user = session.user

  const stats = [
    {
      label: "Total Applications",
      value: "0",
      icon: Mail,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Active Responses",
      value: "0",
      icon: ArrowUpRight,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Pending MFA",
      value: "0",
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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

      {/* Stats Grid */}
      <div className="mb-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-center gap-4">
              <div className={`${stat.bg} ${stat.color} rounded-xl p-3`}>
                <stat.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">
                  {stat.label}
                </p>
                <p className="text-2xl font-bold text-primary">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Areas */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column: Recent Activity / Resume */}
        <div className="space-y-8 lg:col-span-2">
          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-50 p-6">
              <h2 className="font-display text-xl font-bold text-primary">
                Resume Profile
              </h2>
              <Link
                href="/dashboard/resume"
                className="flex items-center gap-1 text-sm font-semibold text-secondary hover:underline"
              >
                Edit
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="p-12 text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-gray-200 bg-gray-50">
                <FileText className="h-10 w-10 text-gray-300" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-primary">
                No resume uploaded yet
              </h3>
              <p className="mx-auto mb-6 max-w-sm text-sm text-gray-500">
                Upload your CV once to let the AI agent learn your background
                and draft perfect letters.
              </p>
              <Link
                href="/dashboard/resume"
                className="inline-flex items-center gap-2 rounded-lg bg-secondary px-6 py-2.5 font-semibold text-white transition-opacity hover:opacity-90"
              >
                Upload CV (PDF)
              </Link>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-50 p-6">
              <h2 className="font-display text-xl font-bold text-primary">
                Recent Applications
              </h2>
            </div>
            <div className="p-12 text-center">
              <p className="text-gray-400 italic">
                No applications sent yet. Start by finding a job listing!
              </p>
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
