import { auth0 } from "@/lib/auth0"
import Link from "next/link"
import { ArrowRight, Check } from "lucide-react"

const logos = [
  "Symmetric",
  "Human Ventures",
  "Greenfield",
  "Vitalize",
  "Remote First",
  "Lerer Hippeau",
]

const agents = [
  {
    title: "Job Match Scanner",
    detail: "Paste a role and instantly extract requirements, seniority, and fit signals.",
    tone: "bg-[#ebd3f7]",
    rotate: "-rotate-3",
  },
  {
    title: "Cover Letter Generator",
    detail: "Generate tailored letters from your resume and each job description.",
    tone: "bg-[#f6ecd2]",
    rotate: "rotate-1",
  },
  {
    title: "Inbox Reply Tracker",
    detail: "Track opens, replies, and timeline updates after every application send.",
    tone: "bg-[#e5f4d7]",
    rotate: "-rotate-2",
  },
]

const sections = [
  {
    eyebrow: "Application writing",
    title: "Personalized applications in minutes, not hours.",
    points: [
      "Turn a job posting into a structured application brief",
      "Draft a role-specific cover letter with your own tone",
      "Edit before sending so you stay in control",
    ],
    accent: "from-[#fd9c5f] to-[#7187ff]",
  },
  {
    eyebrow: "Pipeline visibility",
    title: "See what is working across every application.",
    points: [
      "Track sent, opened, replied, interview, and offer states",
      "Get next-step guidance when momentum slows",
      "Review activity in one dashboard instead of scattered inbox threads",
    ],
    accent: "from-[#70b7ff] to-[#6f7af8]",
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
          <Link href="/" className="font-display text-3xl font-semibold tracking-tight">
            AutoApply
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <a href="#pricing" className="hidden text-black/70 hover:text-black sm:inline-block">
              Pricing
            </a>
            <a href="#blog" className="hidden text-black/70 hover:text-black sm:inline-block">
              Blog
            </a>
            <a
              href={primaryHref}
              className="rounded-full border border-black bg-black px-4 py-2 text-sm font-semibold text-white"
            >
              {primaryLabel} ↗
            </a>
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
            Upload your resume once. Generate tailored cover letters, send through your own Gmail, and track responses in one place.
          </p>
          <a
            href={primaryHref}
            className="mt-8 inline-flex items-center gap-2 rounded-full border border-black bg-black px-6 py-3 text-base font-semibold text-white"
          >
            {primaryLabel}
            <ArrowRight className="h-4 w-4" />
          </a>
          <p className="mt-4 text-xs tracking-[0.12em] text-black/35 uppercase">
            Free forever. No credit card required
          </p>
        </section>

        <section className="mt-16 grid gap-4 md:grid-cols-3">
          {agents.map((agent) => (
            <article
              key={agent.title}
              className={`rounded-3xl p-6 shadow-[0_10px_30px_rgba(30,26,38,0.08)] ${agent.tone} ${agent.rotate}`}
            >
              <h3 className="font-display text-3xl leading-tight tracking-tight">{agent.title}</h3>
              <p className="mt-4 max-w-[26ch] text-sm leading-relaxed text-black/65">{agent.detail}</p>
              <div className="mt-6 h-14 w-14 rounded-xl bg-white/70" />
            </article>
          ))}
        </section>

        <section className="mt-16 sm:mt-24">
          <h2 className="text-center font-display text-5xl italic tracking-tight sm:text-6xl">
            Backing our vision
          </h2>
          <div className="mt-8 grid grid-cols-2 gap-y-4 text-center text-black/45 sm:grid-cols-3 lg:grid-cols-6">
            {logos.map((logo) => (
              <p key={logo} className="text-sm font-semibold tracking-wide uppercase">
                {logo}
              </p>
            ))}
          </div>
          <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {["Scott Belsky", "Eric Ries", "Mariano Battilana", "Brian Sugar"].map((name) => (
              <div key={name} className="rounded-xl bg-white px-3 py-2 text-xs text-black/70 shadow-sm">
                {name}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 space-y-7 sm:mt-24">
          {sections.map((section, index) => (
            <article key={section.title} className="rounded-3xl bg-[#efede7] p-5 sm:p-8">
              <div className="grid items-center gap-8 md:grid-cols-2">
                <div className={index % 2 === 1 ? "md:order-2" : ""}>
                  <p className="text-xs font-semibold tracking-[0.08em] text-black/45 uppercase">
                    {section.eyebrow}
                  </p>
                  <h3 className="mt-3 max-w-[18ch] font-display text-5xl leading-[0.95] tracking-tight">
                    {section.title}
                  </h3>
                  <ul className="mt-5 space-y-2.5">
                    {section.points.map((point) => (
                      <li key={point} className="flex items-start gap-2 text-sm text-black/65">
                        <span className="mt-0.5 rounded-md bg-[#d3e2ff] p-1">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div
                  className={`h-[230px] rounded-2xl bg-gradient-to-br ${section.accent} shadow-[0_15px_30px_rgba(30,26,38,0.14)] ${
                    index % 2 === 1 ? "md:order-1" : ""
                  }`}
                />
              </div>
            </article>
          ))}
        </section>

        <section id="pricing" className="mt-16 pb-10 text-center sm:mt-20">
          <a
            href={primaryHref}
            className="inline-flex items-center gap-2 rounded-full bg-[#1f1b2a] px-6 py-3 text-sm font-semibold text-white"
          >
            {session ? "Review your applications" : "Start applying with AI"}
            <ArrowRight className="h-4 w-4" />
          </a>
        </section>
      </div>
    </div>
  )
}
