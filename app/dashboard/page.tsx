import { auth0 } from "@/lib/auth0"
import { redirect } from "next/navigation"
import Link from "next/link"
import {
  ArrowRight,
  FileText,
  LayoutDashboard,
  Mail,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  LogOut,
} from "lucide-react"
import {
  ApplicationsTable,
  CheckInboxButton,
  DashboardStatCards,
  DashboardWeeklyFocus,
} from "@/components/DashboardClient"
import { ResumeProfileBox } from "@/components/ResumeProfileBox"
import { PendingActions } from "@/components/PendingActions"
import { TelegramLinkCard } from "@/components/TelegramLinkCard"
import { TelegramLinkedDialog } from "@/components/TelegramLinkedDialog"
import { OnboardingGuard } from "@/components/OnboardingGuard"
import { DiscoveredJobs } from "@/components/DiscoveredJobs"
import { TokenSync } from "@/components/TokenSync"

const quickActions = [
  {
    title: "New application",
    detail: "Paste a job post, generate a tailored draft, and send from Gmail.",
    href: "/dashboard/new",
    tone: "bg-[#e9def9]",
  },
  {
    title: "Resume profile",
    detail: "Update your experience so every generated letter stays accurate.",
    href: "/dashboard/resume",
    tone: "bg-[#f6ecd2]",
  },
  {
    title: "Preferences",
    detail: "Define role, location, and salary filters for smarter matching.",
    href: "/dashboard/preferences",
    tone: "bg-[#dff0db]",
  },
  {
    title: "Security",
    detail: "Control approval and authentication settings before sends.",
    href: "/permissions",
    tone: "bg-[#dcebf8]",
  },
]

const navLinks = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: LayoutDashboard,
    active: true,
  },
  {
    href: "/dashboard/resume",
    label: "Resume Profile",
    icon: FileText,
    active: false,
  },
  {
    href: "/dashboard/preferences",
    label: "Preferences",
    icon: Settings2,
    active: false,
  },
  {
    href: "/permissions",
    label: "Security",
    icon: ShieldCheck,
    active: false,
  },
]

export default async function DashboardPage() {
  const session = await auth0.getSession()
  if (!session) {
    redirect("/auth/login")
  }

  const user = session.user

  return (
    <OnboardingGuard userId={user.sub!}>
      <TokenSync />
      <div className="min-h-screen bg-[#f5f3f2]">
        <TelegramLinkedDialog />

        <div className="mx-auto max-w-[1120px] px-4 py-6 sm:px-6 sm:py-8">
          <section className="rounded-[30px] border border-black/10 bg-white p-5 shadow-[0_12px_40px_rgba(20,17,28,0.06)] sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 font-display text-xl font-semibold"
              >
                <Star className="h-4 w-4 fill-black" />
                AutoApply
              </Link>

              <nav className="hidden items-center gap-2 rounded-full border border-black/10 bg-[#f8f6f5] p-1 md:flex">
                <a
                  href="#overview"
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-black/70 transition-colors hover:text-black"
                >
                  Overview
                </a>
                <a
                  href="#applications"
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-black/70 transition-colors hover:text-black"
                >
                  Pipeline
                </a>
                <a
                  href="#tools"
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-black/70 transition-colors hover:text-black"
                >
                  Quick actions
                </a>
              </nav>

              <Link
                href="/dashboard/new"
                className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-xs font-semibold tracking-[0.08em] text-white uppercase"
              >
                <Plus className="h-3.5 w-3.5" />
                New application
              </Link>
            </div>

            <div id="overview" className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.72fr]">
              <div className="rounded-3xl bg-[#f3f0ea] p-6 sm:p-8">
                <p className="text-xs font-semibold tracking-[0.1em] text-black/45 uppercase">
                  Application cockpit
                </p>
                <h1 className="mt-3 max-w-[14ch] font-display text-4xl leading-[0.95] font-semibold tracking-tight sm:text-5xl">
                  Welcome back, {user.name?.split(" ")[0]}
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-black/65 sm:text-base">
                  Generate role-specific drafts, approve sends from Gmail, and
                  monitor engagement from one dashboard.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link
                    href="/dashboard/new"
                    className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-xs font-semibold tracking-[0.08em] text-white uppercase"
                  >
                    Start application
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/dashboard/preferences"
                    className="inline-flex items-center rounded-full border border-black/20 bg-white px-5 py-3 text-xs font-semibold tracking-[0.08em] uppercase"
                  >
                    Preferences
                  </Link>
                </div>
              </div>

              <div className="rounded-3xl border border-black/10 bg-[#f8f7f4] p-4 sm:p-5">
                <DashboardWeeklyFocus userId={user.sub} />
              </div>
            </div>

            <div className="mt-6 rounded-3xl border border-black/10 bg-[#faf9f8] p-3 sm:p-4">
              <DashboardStatCards userId={user.sub} />
            </div>
          </section>

          <section id="tools" className="mt-7">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {quickActions.map((action) => (
                <Link
                  key={action.title}
                  href={action.href}
                  className={`group rounded-3xl border border-black/10 p-5 transition-all hover:-translate-y-0.5 ${action.tone}`}
                >
                  <h3 className="font-display text-2xl leading-tight font-semibold tracking-tight">
                    {action.title}
                  </h3>
                  <p className="mt-3 text-sm text-black/65">{action.detail}</p>
                  <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold">
                    Open
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section
            id="applications"
            className="mt-7 grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_0.85fr]"
          >
            <div className="space-y-6">
              <ResumeProfileBox userId={user.sub} />

              <PendingActions userId={user.sub} />

              <DiscoveredJobs userId={user.sub} />

              <article className="overflow-hidden rounded-3xl border border-black/15 bg-white">
                <div className="flex items-center justify-between border-b border-black/10 p-5">
                  <div>
                    <h2 className="font-display text-2xl font-semibold">
                      Application pipeline
                    </h2>
                    <p className="text-sm text-black/65">
                      Recent applications, status updates, and outcomes.
                    </p>
                  </div>
                  <span className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white uppercase">
                    Live
                  </span>
                </div>
                <div className="p-3">
                  <ApplicationsTable userId={user.sub} />
                </div>
              </article>
            </div>

            <aside className="space-y-5">
              <article className="rounded-3xl border border-black/15 bg-[#17151f] p-5 text-white">
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-black">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h3 className="text-lg font-semibold">Quality signal</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/75">
                  Mirror the job post language and tie each requirement to one
                  concrete result from your resume.
                </p>
              </article>

              <div className="rounded-3xl border border-black/15 bg-white p-4">
                <CheckInboxButton />
              </div>

              <TelegramLinkCard userId={user.sub} />

              <nav className="rounded-3xl border border-black/15 bg-white p-3">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                      link.active
                        ? "bg-black text-white"
                        : "text-black/70 hover:bg-black/5"
                    }`}
                  >
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                ))}
                
                <div className="mx-2 my-2 border-t border-black/5" />
                
                <a
                  href="/auth/logout"
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </a>
              </nav>

              <article className="rounded-3xl border border-black/15 bg-white p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5" />
                  <div>
                    <p className="font-semibold">Approval protection enabled</p>
                    <p className="mt-1 text-sm text-black/70">
                      Every send request requires confirmation before dispatch.
                    </p>
                  </div>
                </div>
              </article>

              <article className="rounded-3xl border border-black/15 bg-white p-4">
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-5 w-5" />
                  <div>
                    <p className="font-semibold">Inbox monitoring active</p>
                    <p className="mt-1 text-sm text-black/70">
                      We keep checking for opens and replies to update your
                      application timeline.
                    </p>
                  </div>
                </div>
              </article>
            </aside>
          </section>
        </div>
      </div>
    </OnboardingGuard>
  )
}
