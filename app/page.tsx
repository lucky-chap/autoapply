import Link from "next/link"
import {
  ArrowRight,
  GitBranch,
  Mail,
  MessageSquare,
  Shield,
  Eye,
  Undo2,
  Zap,
} from "lucide-react"
import { auth0 } from "@/lib/auth0"

const features = [
  {
    icon: GitBranch,
    title: "GitHub Activity",
    description:
      "Automatically reads your commits, PRs, and issues to generate meaningful standups.",
  },
  {
    icon: MessageSquare,
    title: "Multi-Platform Distribution",
    description:
      "Propose actions across Slack and Gmail with platform-specific tone and formatting.",
  },
  {
    icon: Shield,
    title: "Scoped Credentials",
    description:
      "Each agent uses isolated OAuth credentials via Auth0 Token Vault. One agent, one credential.",
  },
  {
    icon: Eye,
    title: "Full Explainability",
    description:
      "Every action shows why it is proposed, what permission it needs, and a grounded confidence score.",
  },
  {
    icon: Zap,
    title: "Step-Up Auth",
    description:
      "High-stakes actions like email require re-authentication so sensitive operations stay controlled.",
  },
  {
    icon: Undo2,
    title: "Undo Window",
    description:
      "Changed your mind? Undo any executed action within 30 seconds.",
  },
]

export default async function LandingPage() {
  const session = await auth0.getSession()
  const isLoggedIn = !!session
  const ctaHref = isLoggedIn ? "/dashboard" : "/auth/login"
  const ctaLabel = isLoggedIn ? "Go to Dashboard" : "Sign In"

  return (
    <div className="relative min-h-screen overflow-hidden bg-neutral-100 text-neutral-900">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-0 h-72 w-72 rounded-full bg-white blur-3xl" />
        <div className="absolute top-8 right-0 h-72 w-72 rounded-full bg-neutral-200/60 blur-3xl" />
      </div>

      <nav className="relative border-b border-neutral-200 bg-white/80 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-black text-white">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <p className="font-display text-lg font-bold text-neutral-900">DevStandup AI</p>
              <p className="text-xs text-neutral-500">AI actions with human approval</p>
            </div>
          </div>

          <Link
            href={ctaHref}
            className="inline-flex h-10 items-center rounded-xl bg-black px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
          >
            {ctaLabel}
          </Link>
        </div>
      </nav>

      <section className="relative px-6 pb-16 pt-24">
        <div className="mx-auto max-w-5xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-3 py-1 text-sm text-neutral-600">
            <Shield className="h-3.5 w-3.5" />
            Powered by Auth0 Token Vault
          </div>
          <h1 className="mb-6 font-display text-5xl font-bold leading-tight text-neutral-900 sm:text-6xl">
            AI can execute fast.
            <br />
            <span className="text-neutral-500">You stay in control.</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-neutral-600">
            DevStandup AI turns your GitHub activity into draft standups, then proposes actions across your tools. You review and approve every step.
          </p>
          <Link
            href={ctaHref}
            className="inline-flex items-center gap-2 rounded-xl bg-black px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
          >
            {isLoggedIn ? "Open Dashboard" : "Get Started"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="relative px-6 pb-20">
        <div className="mx-auto max-w-5xl rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-3 text-xs font-mono uppercase tracking-[0.18em] text-neutral-500">
            Action Queue Preview
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-neutral-200 bg-white text-neutral-700">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-neutral-900">Slack Agent</span>
                  <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs text-neutral-700">chat:write</span>
                </div>
                <p className="mb-2 text-sm text-neutral-600">
                  Post standup to #engineering with highlights from today&apos;s merged PRs and active work.
                </p>
                <div className="text-xs text-neutral-500">87% confident based on 12 commits and 3 PRs</div>
              </div>
              <div className="hidden shrink-0 gap-2 sm:flex">
                <div className="rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white">Approve</div>
                <div className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700">Skip</div>
              </div>
            </div>

            <div className="flex items-start gap-4 rounded-2xl border border-amber-300/70 bg-amber-50/50 p-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-200 bg-white text-amber-700">
                <Mail className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-neutral-900">Gmail Agent</span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">gmail.send</span>
                  <span className="rounded-full bg-amber-200/70 px-2 py-0.5 text-xs text-amber-800">Step-up required</span>
                </div>
                <p className="mb-2 text-sm text-neutral-600">
                  Send a polished weekly update email to leadership with progress summary and next milestones.
                </p>
                <div className="text-xs text-neutral-500">92% confident with full activity context across 3 repos</div>
              </div>
              <div className="hidden shrink-0 gap-2 sm:flex">
                <div className="rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white">Approve</div>
                <div className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700">Skip</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative px-6 pb-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-4 text-center font-display text-3xl font-bold text-neutral-900">
            Built for trust and transparency
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-neutral-500">
            Every AI operation is visible, explainable, and user-approved.
          </p>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
              >
                <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl border border-neutral-200 bg-neutral-100 text-neutral-700">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-neutral-900">{feature.title}</h3>
                <p className="text-sm text-neutral-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative px-6 pb-24">
        <div className="mx-auto max-w-4xl rounded-3xl border border-neutral-200 bg-white p-12 text-center shadow-sm">
          <h2 className="mb-4 font-display text-3xl font-bold text-neutral-900">
            Your work proposes actions.
            <br />
            You approve them.
          </h2>
          <p className="mb-8 text-neutral-500">From code to communication, with full control.</p>
          <Link
            href={ctaHref}
            className="inline-flex items-center gap-2 rounded-xl bg-black px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
          >
            {isLoggedIn ? "Go to Dashboard" : "Start Building Your Standup"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="relative border-t border-neutral-200 px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 text-sm text-neutral-500 sm:flex-row">
          <span>DevStandup AI</span>
          <span>Built with Auth0 Token Vault + Convex + Gemini</span>
        </div>
      </footer>
    </div>
  )
}
