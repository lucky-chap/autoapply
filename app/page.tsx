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
      "Every action shows why it's proposed, what permission it needs, and a grounded confidence score.",
  },
  {
    icon: Zap,
    title: "Step-Up Auth",
    description:
      "High-stakes actions like email require re-authentication. Visual distinction keeps you aware.",
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
    <div className="min-h-screen bg-zinc-950">
      {/* Nav */}
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-display text-lg font-bold text-white">
              DevStandup AI
            </span>
          </div>
          <Link
            href={ctaHref}
            className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-400 transition-colors"
          >
            {ctaLabel}
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-24 pb-16">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-800 text-zinc-400 text-sm mb-6">
            <Shield className="w-3.5 h-3.5" />
            Powered by Auth0 Token Vault
          </div>
          <h1 className="text-5xl sm:text-6xl font-display font-bold text-white leading-tight mb-6">
            AI acts — but only
            <br />
            <span className="text-emerald-400">with your permission</span>
          </h1>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto mb-10">
            DevStandup AI turns your GitHub activity into actionable standups
            and proposes distribution across your tools. You review, approve,
            and control every action.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href={ctaHref}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-400 transition-colors"
            >
              {isLoggedIn ? "Go to Dashboard" : "Get Started"}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Action Queue Preview */}
      <section className="px-6 pb-20">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
            <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2">
              Action Queue Preview
            </div>

            {/* Slack action card */}
            <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4 flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-white">
                    Slack Agent
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                    chat:write
                  </span>
                </div>
                <p className="text-sm text-zinc-400 mb-2">
                  Post standup to #engineering: &quot;Fixed auth middleware,
                  merged PR #42, working on dashboard...&quot;
                </p>
                <div className="text-xs text-zinc-500">
                  87% confident — based on 12 commits and 3 PRs
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <div className="px-3 py-1.5 rounded bg-emerald-500 text-white text-xs font-medium">
                  Approve
                </div>
                <div className="px-3 py-1.5 rounded bg-zinc-700 text-zinc-300 text-xs font-medium">
                  Skip
                </div>
              </div>
            </div>

            {/* Gmail action card (high-stakes) */}
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-white">
                    Gmail Agent
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
                    gmail.send
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-amber-500/30 text-amber-300">
                    Step-up required
                  </span>
                </div>
                <p className="text-sm text-zinc-400 mb-2">
                  Send weekly update to team@company.com with professional
                  summary...
                </p>
                <div className="text-xs text-zinc-500">
                  92% confident — comprehensive activity across 3 repos
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <div className="px-3 py-1.5 rounded bg-amber-500 text-white text-xs font-medium">
                  Approve
                </div>
                <div className="px-3 py-1.5 rounded bg-zinc-700 text-zinc-300 text-xs font-medium">
                  Skip
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 pb-24">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-display font-bold text-white text-center mb-4">
            Built for trust and transparency
          </h2>
          <p className="text-zinc-400 text-center mb-12 max-w-2xl mx-auto">
            Every AI operation is visible, explainable, and user-approved.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-6"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-zinc-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-24">
        <div className="max-w-4xl mx-auto text-center">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12">
            <h2 className="text-3xl font-display font-bold text-white mb-4">
              Your work proposes actions.
              <br />
              You approve them.
            </h2>
            <p className="text-zinc-400 mb-8">
              From code to communication, with control.
            </p>
            <Link
              href={ctaHref}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-400 transition-colors"
            >
              {isLoggedIn ? "Go to Dashboard" : "Start Building Your Standup"}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-6 py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-zinc-500">
          <span>DevStandup AI</span>
          <span>Built with Auth0 Token Vault + Convex + Gemini</span>
        </div>
      </footer>
    </div>
  )
}
