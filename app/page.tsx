import { auth0 } from "@/lib/auth0"

export default async function Home() {
  const session = await auth0.getSession()

  return (
    <div className="mx-auto max-w-4xl px-4 py-24 text-center sm:py-32">
      <h1 className="mb-8 font-display text-5xl leading-[1.1] font-bold tracking-tight text-primary sm:text-7xl">
        The AI Agent that <br />
        <span className="font-medium text-secondary italic">actually</span>{" "}
        applies for you.
      </h1>
      <p className="mx-auto mb-12 max-w-2xl text-lg leading-relaxed font-light text-gray-600 sm:text-xl">
        Upload your CV. Paste a job description. AutoApply drafts personalized
        cover letters and sends them via your own Gmail account—securely, with
        step-up auth.
      </p>

      <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
        {session ? (
          <a
            href="/dashboard"
            className="w-full rounded-xl bg-primary px-8 py-4 font-semibold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl sm:w-auto"
          >
            Go to Dashboard
          </a>
        ) : (
          <a
            href="/auth/login"
            className="w-full rounded-xl bg-primary px-8 py-4 font-semibold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl sm:w-auto"
          >
            Start Free Today
          </a>
        )}
        <button className="w-full rounded-xl border border-gray-200 bg-white px-8 py-4 font-semibold text-primary transition-all hover:bg-gray-50 sm:w-auto">
          How it works
        </button>
      </div>

      <div className="mt-16 flex flex-wrap justify-center gap-4 border-t border-gray-100 pt-10 opacity-40 grayscale sm:mt-24 sm:gap-8 sm:pt-12">
        <span className="font-display font-medium">Auth0 Token Vault</span>
        <span className="font-display font-medium">Convex</span>
        <span className="font-display font-medium">GLM-5</span>
        <span className="font-display font-medium">Gmail API</span>
      </div>
    </div>
  )
}
