import { auth0 } from "@/lib/auth0"
import { redirect } from "next/navigation"
import Link from "next/link"
import {
  ArrowRight,
  FileText,
  LayoutDashboard,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
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

const quickActions = [
  {
    title: "New application",
    detail: "Paste a job description and generate a tailored send flow.",
    href: "/dashboard/new",
    dark: false,
  },
  {
    title: "Resume profile",
    detail: "Keep your resume data updated for stronger personalization.",
    href: "/dashboard/resume",
    dark: true,
  },
  {
    title: "Preferences",
    detail: "Set role, location, and salary targets for better matching.",
    href: "/dashboard/preferences",
    dark: true,
  },
  {
    title: "Security",
    detail: "Review permissions and account protection settings.",
    href: "/permissions",
    dark: false,
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
    <div className="min-h-screen bg-white">
      <TelegramLinkedDialog />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <section>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 font-display text-lg font-semibold"
            >
              <Star className="h-4 w-4 fill-black" />
              AutoApply Dashboard
            </Link>

            <nav className="hidden items-center gap-6 text-xs font-semibold tracking-[0.08em] text-black/70 uppercase md:flex">
              <a href="#overview" className="hover:text-black">
                Overview
              </a>
              <a href="#applications" className="hover:text-black">
                Applications
              </a>
              <a href="#tools" className="hover:text-black">
                Tools
              </a>
            </nav>

            <Link
              href="/dashboard/new"
              className="inline-flex items-center gap-1 rounded-lg border border-black/20 bg-white px-4 py-2 text-xs font-semibold tracking-[0.08em] uppercase"
            >
              <Plus className="h-3.5 w-3.5" />
              New application
            </Link>
          </div>

          <div
            id="overview"
            className="mt-9 grid items-center gap-8 lg:grid-cols-[1fr_0.8fr]"
          >
            <div>
              <h1 className="max-w-xl font-display text-4xl leading-tight font-semibold sm:text-5xl">
                Welcome back, {user.name?.split(" ")[0]}
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-black/65 sm:text-base">
                Manage approvals, send better outreach, and track reply momentum
                from one workflow.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href="/dashboard/new"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#121212] px-5 py-3 text-xs font-semibold tracking-[0.08em] text-white uppercase"
                >
                  Start campaign
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/dashboard/preferences"
                  className="inline-flex items-center rounded-lg border border-black/20 bg-white px-5 py-3 text-xs font-semibold tracking-[0.08em] uppercase"
                >
                  Update settings
                </Link>
              </div>
            </div>

            <DashboardWeeklyFocus userId={user.sub} />
          </div>

          <DashboardStatCards userId={user.sub} />
        </section>

        <section id="tools" className="mt-12">
          <div className="flex flex-wrap items-center gap-4">
            <span className="rounded bg-[#b8ff66] px-2.5 py-1 text-2xl leading-none font-semibold">
              Tools
            </span>
            <p className="max-w-xl text-sm text-black/65">
              Use shortcuts to move through your application process quickly.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {quickActions.map((action) => (
              <Link
                key={action.title}
                href={action.href}
                className={`rounded-3xl border p-6 transition-colors ${
                  action.dark
                    ? "border-black/15 bg-[#161616] text-white hover:bg-black"
                    : "border-black/15 bg-white text-black"
                }`}
              >
                <h3 className="text-2xl leading-tight font-semibold">
                  {action.title}
                </h3>
                <p
                  className={`mt-3 text-sm ${
                    action.dark ? "text-white/70" : "text-black/65"
                  }`}
                >
                  {action.detail}
                </p>
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold">
                  Open
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section
          id="applications"
          className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_0.85fr]"
        >
          <div className="space-y-6">
            <ResumeProfileBox userId={user.sub} />

            <PendingActions userId={user.sub} />

            <article className="overflow-hidden rounded-3xl border border-black/20 bg-[#171717] text-white">
              <div className="flex items-center justify-between border-b border-white/20 p-5">
                <div>
                  <h2 className="font-display text-2xl font-semibold">
                    Applications
                  </h2>
                  <p className="text-sm text-white/70">
                    Recent sends and status updates.
                  </p>
                </div>
                <span className="rounded bg-[#b8ff66] px-3 py-1 text-xs font-semibold text-black uppercase">
                  Live
                </span>
              </div>
              <div className="bg-white p-3 text-black">
                <ApplicationsTable userId={user.sub} />
              </div>
            </article>
          </div>

          <aside className="space-y-5">
            <article className="rounded-3xl border border-black/15 bg-[#161616] p-5 text-white">
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#b8ff66] text-black">
                <Sparkles className="h-4 w-4" />
              </div>
              <h3 className="text-lg font-semibold">Daily pro tip</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/75">
                Mention 2 exact requirements from the job post in your first
                paragraph to boost reply rates.
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
                      ? "bg-[#b8ff66] text-black"
                      : "text-black/70 hover:bg-white"
                  }`}
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Link>
              ))}
            </nav>

            <article className="rounded-3xl border border-black/15 bg-white p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5" />
                <div>
                  <p className="font-semibold">Step-up auth active</p>
                  <p className="mt-1 text-sm text-black/70">
                    Every send request requires confirmation before dispatching.
                  </p>
                </div>
              </div>
            </article>
          </aside>
        </section>
      </div>
    </div>
  )
}
