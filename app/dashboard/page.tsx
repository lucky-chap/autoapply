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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"

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
          <section className="px-5 py-8 sm:px-7">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight text-black sm:text-5xl">
                  Welcome back, {user.name?.split(" ")[0]}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-black/60 sm:text-base">
                  Your application cockpit for managing roles, drafts, and
                  engagement.
                </p>
              </div>
              <Link
                href="/dashboard/new"
                className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-xs font-semibold tracking-widest text-white uppercase transition-colors hover:bg-black/90"
              >
                <Plus className="h-3.5 w-3.5" />
                New application
              </Link>
            </div>

            <div className="mt-10">
              <DashboardStatCards userId={user.sub} />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 px-5 pb-12 sm:px-7 lg:grid-cols-[1fr_0.45fr]">
            <div className="space-y-8">
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-bold tracking-widest text-black/40 uppercase">
                    High Priority
                  </h2>
                </div>
                <PendingActions userId={user.sub} />
              </div>

              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-bold tracking-widest text-black/40 uppercase">
                    Match Opportunities
                  </h2>
                </div>
                <DiscoveredJobs userId={user.sub} />
              </div>

              <div>
                <Card className="overflow-hidden border-black/5 shadow-sm">
                  <CardHeader className="border-b border-black/5 p-5">
                    <CardTitle className="font-display text-2xl font-semibold text-black">
                      Application pipeline
                    </CardTitle>
                    <CardDescription className="text-sm text-black/50">
                      Recent applications, status updates, and outcomes.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="p-3">
                      <ApplicationsTable userId={user.sub} />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <aside className="-col-start-1 w-full space-y-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-bold tracking-widest text-black/40 uppercase">
                  Weekly Focus
                </h2>
              </div>
              <Card className="overflow-hidden border-black/5 shadow-sm">
                <DashboardWeeklyFocus userId={user.sub} />
              </Card>

              <ResumeProfileBox userId={user.sub} />
              <CheckInboxButton />

              <TelegramLinkCard userId={user.sub} />
            </aside>
          </section>
        </div>
      </div>
    </OnboardingGuard>
  )
}
