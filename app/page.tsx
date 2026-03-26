import { auth0 } from "@/lib/auth0"
import Link from "next/link"
import {
  ArrowRight,
  Heart,
  Mail,
  MapPin,
  Megaphone,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react"

const brands = [
  "Auth0",
  "Convex",
  "Gmail API",
  "Telegram",
  "GLM-5",
  "Tracking",
]

const services = [
  {
    title: "Job match analysis",
    description:
      "Identify key requirements from each role and align your experience automatically.",
    icon: Search,
    dark: false,
  },
  {
    title: "AI cover letter drafting",
    description:
      "Generate personalized, role-specific letters in seconds from one job description.",
    icon: Sparkles,
    dark: true,
  },
  {
    title: "Email sending workflow",
    description:
      "Send applications from your own Gmail with clear approval controls.",
    icon: Mail,
    dark: true,
  },
  {
    title: "Security + approvals",
    description:
      "Protect every send request with step-up checks before dispatch.",
    icon: ShieldCheck,
    dark: false,
  },
]

const studies = [
  "One candidate increased interview callbacks by 35% in 4 weeks using targeted outreach.",
  "A product manager reached 8 final-round interviews with role-specific application messaging.",
  "A career coach scaled applications for clients with reusable templates and approval workflows.",
]

const plans = [
  {
    name: "Starter",
    price: "$0",
    detail: "Try the full workflow with basic limits.",
  },
  {
    name: "Pro",
    price: "$29",
    detail: "Designed for active job seekers who apply at scale.",
  },
]

export default async function Home() {
  const session = await auth0.getSession()
  const primaryHref = session ? "/dashboard" : "/auth/login"

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[930px] px-6 py-8 sm:px-10 sm:py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-display text-xl font-semibold"
          >
            <Star className="h-4 w-4 fill-black" />
            AutoApply
          </Link>

          <nav className="hidden items-center gap-5 text-xs font-semibold tracking-[0.08em] text-black/70 uppercase md:flex">
            <a href="#about" className="hover:text-black">
              About us
            </a>
            <a href="#services" className="hover:text-black">
              Features
            </a>
            <a href="#case-study" className="hover:text-black">
              Use cases
            </a>
            <a href="#pricing" className="hover:text-black">
              Pricing
            </a>
            <a href="#" className="hover:text-black">
              Blog
            </a>
          </nav>

          <a
            href={primaryHref}
            className="rounded-lg border border-black/25 bg-white px-4 py-2 text-xs font-semibold tracking-[0.08em] uppercase"
          >
            {session ? "Open dashboard" : "Start now"}
          </a>
        </header>

        <section className="mt-10 grid items-center gap-10 lg:grid-cols-[1fr_0.95fr]">
          <div>
            <h1 className="max-w-xl font-display text-4xl leading-tight font-semibold sm:text-5xl">
              Automate your job applications with confidence
            </h1>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-black/65">
              AutoApply helps you upload your resume, generate tailored cover
              letters, send via your own Gmail, and track replies in one
              workflow.
            </p>
            <a
              href={primaryHref}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#121212] px-5 py-3 text-xs font-semibold tracking-[0.08em] text-white uppercase"
            >
              Book a consultation
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="relative h-[290px] rounded-2xl border border-black/10 bg-white">
              <div className="absolute left-12 top-12 h-40 w-56 rotate-[-12deg] rounded-full border border-black/25" />
              <div className="absolute left-10 top-20 h-36 w-56 rotate-[10deg] rounded-full border border-black/25" />
              <div className="absolute right-20 top-20 flex h-28 w-28 items-center justify-center rounded-full bg-[#b8ff66]">
                <Megaphone className="h-12 w-12 text-black" />
              </div>

              <div className="absolute left-4 top-8 flex h-8 w-8 items-center justify-center rounded-full bg-black text-white">
                <Heart className="h-4 w-4" />
              </div>
              <div className="absolute right-8 top-6 flex h-8 w-8 items-center justify-center rounded-full bg-[#b8ff66] text-black">
                <Mail className="h-4 w-4" />
              </div>
              <div className="absolute right-4 top-20 flex h-8 w-8 items-center justify-center rounded-full bg-black text-white">
                <Play className="h-4 w-4 fill-white" />
              </div>
              <div className="absolute right-10 top-36 flex h-8 w-8 items-center justify-center rounded-full bg-[#b8ff66] text-black">
                <MapPin className="h-4 w-4" />
              </div>
              <Sparkles className="absolute bottom-8 left-6 h-5 w-5 text-black" />
            </div>
          </div>
        </section>

        <section className="mt-10 grid grid-cols-3 gap-4 border-y border-black/15 py-6 text-center sm:grid-cols-6">
          {brands.map((brand) => (
            <p key={brand} className="text-sm font-semibold text-black/70">
              {brand}
            </p>
          ))}
        </section>

        <section id="services" className="mt-10">
          <div className="flex flex-wrap items-center gap-4">
            <span className="rounded bg-[#b8ff66] px-2.5 py-1 text-2xl font-semibold leading-none">
              Features
            </span>
            <p className="max-w-xl text-sm text-black/65">
              AutoApply gives you everything needed to move faster while keeping
              quality and control.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {services.map((service) => (
              <article
                key={service.title}
                className={`rounded-3xl border p-6 ${
                  service.dark
                    ? "border-black/20 bg-[#171717] text-white"
                    : "border-black/20 bg-white text-black"
                }`}
              >
                <service.icon className="h-5 w-5" />
                <h3 className="mt-3 max-w-xs text-2xl leading-tight font-semibold">
                  <span
                    className={`${
                      service.dark
                        ? "bg-white text-black"
                        : "bg-[#b8ff66] text-black"
                    } px-1.5`}
                  >
                    {service.title}
                  </span>
                </h3>
                <p
                  className={`mt-4 text-sm leading-relaxed ${
                    service.dark ? "text-white/75" : "text-black/65"
                  }`}
                >
                  {service.description}
                </p>
                <div className="mt-5 flex items-center gap-2 text-sm font-semibold">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full ${
                      service.dark
                        ? "bg-white text-black"
                        : "bg-black text-white"
                    }`}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </span>
                  Learn more
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="about" className="mt-10 rounded-3xl border border-black/10 bg-white p-6 sm:p-8">
          <div className="grid items-center gap-6 md:grid-cols-[1fr_0.6fr]">
            <div>
              <h2 className="font-display text-3xl font-semibold">
                Let&apos;s get your next role faster
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-black/65">
                Tell us your target role and we&apos;ll help you set up a repeatable
                application system with better conversion.
              </p>
              <a
                href={primaryHref}
                className="mt-5 inline-flex rounded-lg bg-[#121212] px-4 py-2 text-xs font-semibold tracking-[0.08em] text-white uppercase"
              >
                Get your free setup
              </a>
            </div>

            <div className="flex items-center justify-center">
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-black text-white">
                <Sparkles className="h-7 w-7" />
                <div className="absolute -bottom-3 -right-2 h-8 w-8 rounded-full bg-[#b8ff66]" />
              </div>
            </div>
          </div>
        </section>

        <section id="case-study" className="mt-10">
          <div className="flex flex-wrap items-center gap-4">
            <span className="rounded bg-[#b8ff66] px-2.5 py-1 text-2xl font-semibold leading-none">
              Case studies
            </span>
            <p className="max-w-xl text-sm text-black/65">
              Real examples from candidates and teams using AutoApply.
            </p>
          </div>

          <div className="mt-6 rounded-3xl border border-black/20 bg-[#171717] p-6 text-white">
            <div className="grid gap-5 md:grid-cols-3 md:divide-x md:divide-white/20">
              {studies.map((study) => (
                <article key={study} className="md:px-5 first:md:pl-0 last:md:pr-0">
                  <p className="text-sm leading-relaxed text-white/80">{study}</p>
                  <a
                    href={primaryHref}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#b8ff66]"
                  >
                    Learn more
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="mt-10 grid gap-4 sm:grid-cols-2">
          {plans.map((plan, idx) => (
            <article
              key={plan.name}
              className={`rounded-2xl border border-black/15 p-6 ${
                idx === 1 ? "bg-[#171717] text-white" : "bg-white"
              }`}
            >
              <p className="text-xs font-semibold tracking-[0.08em] uppercase">
                {plan.name}
              </p>
              <p className="mt-2 font-display text-4xl font-semibold">{plan.price}</p>
              <p className={`mt-1 text-sm ${idx === 1 ? "text-white/75" : "text-black/65"}`}>
                {plan.detail}
              </p>
            </article>
          ))}
        </section>
      </div>
    </div>
  )
}
