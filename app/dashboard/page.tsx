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

export default async function DashboardPage() {
  const session = await auth0.getSession()
  if (!session) {
    redirect("/auth/login")
  }

  const user = session.user

  return (
    <OnboardingGuard userId={user.sub!}>
      <TokenSync />
      <div className="flex flex-1 flex-col gap-6 bg-white p-4 pt-4">
        <TelegramLinkedDialog />

        <div className="mx-auto w-full max-w-6xl">
          <section className="p-5 sm:p-7">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="font-display text-4xl font-semibold tracking-tight text-black sm:text-5xl md:leading-[1.1]">
                  Welcome back, {user.name?.split(" ")[0]}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-black/60 sm:text-base">
                  Your application cockpit for managing roles, drafts, and engagement.
                </p>
              </div>
              <Link
                href="/dashboard/new"
                className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-xs font-semibold tracking-[0.08em] text-white uppercase hover:bg-black/90"
              >
                <Plus className="h-3.5 w-3.5" />
                New application
              </Link>
            </div>

            <div
              id="overview"
              className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.72fr]"
            >
              <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm sm:p-8">
                <span className="text-xs font-semibold tracking-widest text-black/40 uppercase">
                  Current activity
                </span>
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-black/70 sm:text-base">
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
                    className="inline-flex items-center rounded-full border border-black/10 bg-transparent px-5 py-3 text-xs font-semibold tracking-[0.08em] text-black uppercase hover:bg-black/5"
                  >
                    Preferences
                  </Link>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
                <DashboardWeeklyFocus userId={user.sub} />
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
              <DashboardStatCards userId={user.sub} />
            </div>
          </section>

          <section
            id="applications"
            className="mt-7 grid grid-cols-1 gap-6 p-5 sm:p-7 lg:grid-cols-[1.5fr_0.85fr]"
          >
            <div className="space-y-6">
              <ResumeProfileBox userId={user.sub} />
              <PendingActions userId={user.sub} />
              <DiscoveredJobs userId={user.sub} />

              <article className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-black/5 p-5">
                  <div>
                    <h2 className="font-display text-2xl font-semibold text-black">
                      Application pipeline
                    </h2>
                    <p className="text-sm text-black/50">
                      Recent applications, status updates, and outcomes.
                    </p>
                  </div>
                </div>
                <div className="p-3">
                  <ApplicationsTable userId={user.sub} />
                </div>
              </article>
            </div>

            <aside className="space-y-5">
              <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
                <CheckInboxButton />
              </div>

              <TelegramLinkCard userId={user.sub} />

              <article className="rounded-2xl border border-black/5 bg-[#fafafa] p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 text-black/70" />
                  <div>
                    <p className="font-semibold text-black">
                      Approval protection enabled
                    </p>
                    <p className="mt-1 text-sm text-black/50">
                      Every send request requires confirmation before dispatch.
                    </p>
                  </div>
                </div>
              </article>

              <article className="rounded-2xl border border-black/5 bg-[#fafafa] p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-5 w-5 text-black/70" />
                  <div>
                    <p className="font-semibold text-black">
                      Inbox monitoring active
                    </p>
                    <p className="mt-1 text-sm text-black/50">
                      We keep checking for opens and replies to update your
                      timeline.
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
