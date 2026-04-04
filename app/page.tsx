import { auth0 } from "@/lib/auth0"
import Link from "next/link"
import {
  ArrowRight,
  Check,
  Search,
  FileSignature,
  Calendar,
  Sparkles,
  Send,
} from "lucide-react"

const hiredAt = [
  "Stripe",
  "Netflix",
  "Linear",
  "Vercel",
  "Figma",
  "Notion",
  "Ramp",
  "Perplexity",
]

const agents = [
  {
    title: "Job Match Scanner",
    detail:
      "Paste a role and instantly extract requirements, seniority, and fit signals.",
    tone: "bg-[#ebd3f7]",
    rotate: "-rotate-3",
    icon: Search,
  },
  {
    title: "Cover Letter Generator",
    detail:
      "Generate tailored letters from your resume and each job description.",
    tone: "bg-[#f6ecd2]",
    rotate: "rotate-1",
    icon: FileSignature,
  },
  {
    title: "Inbox & Calendar Sync",
    detail:
      "Track replies and automatically add scheduled interviews back to your calendar.",
    tone: "bg-[#e5f4d7]",
    rotate: "-rotate-2",
    icon: Calendar,
  },
]

const AppWritingGraphic = () => (
  <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-black/5 bg-[#fcfcfc] shadow-[0_15px_30px_rgba(30,26,38,0.14)]">
    <div className="flex items-center gap-2 border-b border-black/5 bg-[#f6f4f4] px-4 py-3">
      <div className="flex gap-1.5">
        <div className="h-2.5 w-2.5 rounded-full bg-black/20" />
        <div className="h-2.5 w-2.5 rounded-full bg-black/20" />
        <div className="h-2.5 w-2.5 rounded-full bg-black/20" />
      </div>
      <div className="ml-2 text-xs font-medium text-black/40">
        New Application
      </div>
    </div>
    <div className="flex flex-1 flex-col gap-3 p-4">
      <div className="flex items-center gap-3 rounded-lg bg-[#ebd3f7]/30 p-3">
        <Sparkles className="h-5 w-5 text-[#9b51e0]" />
        <div className="space-y-1.5">
          <div className="h-2 w-24 rounded bg-black/20" />
          <div className="h-2 w-16 rounded bg-black/10" />
        </div>
      </div>
      <div className="space-y-2 rounded-lg border border-black/5 p-3">
        <div className="h-2 w-full rounded bg-black/10" />
        <div className="h-2 w-[90%] rounded bg-black/10" />
        <div className="h-2 w-[80%] rounded bg-black/10" />
        <div className="h-2 w-[40%] rounded bg-black/10" />
      </div>
      <div className="mt-auto flex justify-end">
        <div className="flex items-center gap-1.5 rounded-full bg-black px-3 py-1.5 text-[10px] font-semibold text-white">
          <Send className="h-3 w-3" />
          Send
        </div>
      </div>
    </div>
  </div>
)

const PipelineGraphic = () => (
  <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-black/5 bg-[#fcfcfc] p-4 shadow-[0_15px_30px_rgba(30,26,38,0.14)]">
    <div className="mb-4 text-[10px] font-semibold tracking-widest text-black/40 uppercase">
      Active Pipeline
    </div>
    <div className="flex flex-1 flex-col justify-center gap-3">
      {[
        {
          company: "Stripe",
          role: "Software Engineer",
          status: "Interview",
          color: "bg-[#e5f4d7]",
          text: "text-[#1f8f57]",
        },
        {
          company: "Linear",
          role: "Product Engineer",
          status: "Replied",
          color: "bg-[#d3e2ff]",
          text: "text-[#2f5cbf]",
        },
        {
          company: "Vercel",
          role: "Frontend Engineer",
          status: "Applied",
          color: "bg-black/5",
          text: "text-black/60",
        },
      ].map((job, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-xl border border-black/5 p-3"
        >
          <div className="flex items-center gap-3">
            <div className={`h-8 w-8 rounded-lg ${job.color}`} />
            <div>
              <div className="text-sm font-semibold text-black/80">
                {job.company}
              </div>
              <div className="text-xs text-black/50">{job.role}</div>
            </div>
          </div>
          <div
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase ${job.color} ${job.text}`}
          >
            {job.status}
          </div>
        </div>
      ))}
    </div>
  </div>
)

const sections = [
  {
    eyebrow: "Application writing",
    title: "Personalized applications in minutes, not hours.",
    points: [
      "Turn a job posting into a structured application brief",
      "Draft a role-specific cover letter with your own tone",
      "Edit before sending so you stay in control",
    ],
    graphic: AppWritingGraphic,
  },
  {
    eyebrow: "Pipeline visibility",
    title: "See what is working across every application.",
    points: [
      "Track sent, opened, replied, interview, and offer states",
      "Automatically sync scheduled interviews directly to your calendar",
      "Review activity in one dashboard instead of scattered inbox threads",
    ],
    graphic: PipelineGraphic,
  },
]

export default async function Home() {
  const session = await auth0.getSession()
  const primaryHref = session ? "/dashboard" : "/auth/login"
  const primaryLabel = session ? "Open job dashboard" : "Start auto-applying"

  return (
    <div className="min-h-screen bg-[#f6f4f4] text-[#1e1a26]">
      <div className="mx-auto max-w-[1080px] px-5 py-7 sm:px-8 sm:py-9">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="font-display text-3xl font-semibold tracking-tight"
          >
            AutoApply
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link
              href="#pricing"
              className="hidden text-black/70 hover:text-black sm:inline-block"
            >
              Pricing
            </Link>

            <Link
              href={primaryHref}
              className="rounded-full border border-black bg-black px-4 py-2 text-sm font-semibold text-white"
            >
              {primaryLabel} ↗
            </Link>
          </nav>
        </header>

        <section className="mx-auto mt-14 max-w-[760px] text-center sm:mt-20">
          <div className="mx-auto h-14 w-14 rounded-full bg-gradient-to-b from-[#bc9eff] via-[#f7bee5] to-[#ffbf69] blur-sm" />
          <h1 className="mt-4 font-display text-5xl leading-[1.02] tracking-tight sm:text-7xl">
            AI job applications
            <br />
            on <span className="italic">autopilot.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-base text-black/70">
            Upload your resume once. Generate tailored cover letters, send
            through your own Gmail, and track responses in one place.
          </p>
          <a
            href={primaryHref}
            className="mt-8 inline-flex items-center gap-2 rounded-full border border-black bg-black px-6 py-3 text-base font-semibold text-white"
          >
            {primaryLabel}
            <ArrowRight className="h-4 w-4" />
          </a>
          <p className="mt-4 text-xs tracking-widest text-black/35 uppercase">
            Free forever. No credit card required
          </p>
        </section>

        <section className="mt-16 grid gap-4 md:grid-cols-3">
          {agents.map((agent) => (
            <article
              key={agent.title}
              className={`rounded-3xl p-6 shadow-[0_10px_30px_rgba(30,26,38,0.08)] ${agent.tone} ${agent.rotate}`}
            >
              <h3 className="font-display text-3xl leading-tight tracking-tight">
                {agent.title}
              </h3>
              <p className="mt-4 max-w-[26ch] text-sm leading-relaxed text-black/65">
                {agent.detail}
              </p>
              <div className="mt-6 flex h-14 w-14 items-center justify-center rounded-xl bg-white/70">
                <agent.icon className="h-6 w-6 text-black/80" />
              </div>
            </article>
          ))}
        </section>

        <section className="mx-auto mt-24 max-w-4xl px-4 text-center sm:mt-32 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold tracking-widest text-black/40 uppercase">
            Candidates secured interviews at
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-6 sm:gap-10">
            {hiredAt.map((company) => (
              <div
                key={company}
                className="flex items-center justify-center opacity-50 grayscale transition-all duration-300 hover:opacity-100 hover:grayscale-0"
              >
                <div className="font-display text-xl font-bold tracking-tight text-black sm:text-2xl">
                  {company}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 space-y-7 sm:mt-24">
          {sections.map((section, index) => (
            <article
              key={section.title}
              className="rounded-3xl bg-[#efede7] p-5 sm:p-8"
            >
              <div className="grid items-center gap-8 md:grid-cols-2">
                <div className={index % 2 === 1 ? "md:order-2" : ""}>
                  <span className="text-xs font-semibold tracking-widest text-black/40 uppercase">
                    {section.eyebrow}
                  </span>
                  <h3 className="mt-3 max-w-[18ch] font-display text-5xl leading-[0.95] tracking-tight">
                    {section.title}
                  </h3>
                  <ul className="mt-5 space-y-2.5">
                    {section.points.map((point) => (
                      <li
                        key={point}
                        className="flex items-start gap-2 text-sm text-black/65"
                      >
                        <span className="mt-0.5 rounded-md bg-[#d3e2ff] p-1">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div
                  className={`h-[280px] w-full ${
                    index % 2 === 1 ? "md:order-1" : ""
                  }`}
                >
                  <section.graphic />
                </div>
              </div>
            </article>
          ))}
        </section>

        <section
          id="pricing"
          className="mx-auto mt-24 max-w-5xl px-4 sm:px-6 lg:px-8"
        >
          <div className="text-center">
            <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-base text-black/60">
              Start for free, upgrade when you need more power.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:mx-auto lg:max-w-4xl lg:gap-8">
            <div className="rounded-3xl border border-black/10 bg-white p-8 shadow-sm">
              <h3 className="text-xl font-semibold">Free</h3>
              <p className="mt-2 text-sm text-black/60">
                Perfect for getting started
              </p>
              <div className="mt-6 font-display text-4xl font-bold">
                $0
                <span className="text-xl font-semibold tracking-normal text-black/40">
                  /mo
                </span>
              </div>
              <ul className="mt-8 space-y-4">
                <li className="flex items-center gap-3 text-sm">
                  <Check className="h-4 w-4 text-black/40" /> 10 AI applications
                  per month
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <Check className="h-4 w-4 text-black/40" /> Basic inbox
                  tracking
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <Check className="h-4 w-4 text-black/40" /> 1 resume profile
                </li>
              </ul>
              <a
                href={primaryHref}
                className="mt-8 block rounded-full border border-black/10 bg-[#f6f4f4] py-3 text-center text-sm font-semibold transition-colors hover:bg-black/5"
              >
                Get started
              </a>
            </div>
            <div className="rounded-3xl border border-[#1e1a26] bg-[#1e1a26] p-8 text-white shadow-xl">
              <h3 className="text-xl font-semibold">Pro</h3>
              <p className="mt-2 text-sm text-white/60">
                For serious job seekers
              </p>
              <div className="mt-6 font-display text-4xl font-bold">
                $29
                <span className="text-xl font-semibold tracking-normal text-white/40">
                  /mo
                </span>
              </div>
              <ul className="mt-8 space-y-4">
                <li className="flex items-center gap-3 text-sm">
                  <Check className="h-4 w-4 text-white/60" /> Unlimited AI
                  applications
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <Check className="h-4 w-4 text-white/60" /> Calendar sync &
                  scheduling
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <Check className="h-4 w-4 text-white/60" /> Multiple resume
                  variants
                </li>
              </ul>
              <a
                href={primaryHref}
                className="mt-8 block rounded-full bg-white py-3 text-center text-sm font-semibold text-black transition-colors hover:bg-white/90"
              >
                Upgrade to Pro
              </a>
            </div>
          </div>
        </section>

        <section className="mt-16 pb-16 text-center sm:my-20">
          <a
            href={primaryHref}
            className="inline-flex items-center gap-2 rounded-full bg-black/5 px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-black/10"
          >
            {session ? "Enter dashboard" : "Start applying"}
            <ArrowRight className="h-4 w-4" />
          </a>
        </section>
      </div>
    </div>
  )
}
