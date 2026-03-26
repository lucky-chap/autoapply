import Link from "next/link"
import { auth0 } from "@/lib/auth0"
import { ArrowRight, Star } from "lucide-react"

export async function Navbar() {
  const session = await auth0.getSession()
  const user = session?.user

  return (
    <nav className="sticky top-0 z-50 border-b border-black/15 bg-[#a7a7a7]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-2 font-display text-lg font-semibold text-black">
          <Star className="h-4 w-4 fill-black" />
          AutoApply
        </Link>

        {!user && (
          <div className="hidden items-center gap-6 text-xs font-semibold tracking-[0.08em] text-black/70 uppercase md:flex">
            <a href="#services" className="hover:text-black">Services</a>
            <a href="#pricing" className="hover:text-black">Pricing</a>
            <a href="#case-study" className="hover:text-black">Case study</a>
          </div>
        )}

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="hidden rounded-lg border border-black/20 bg-white px-3 py-2 text-xs font-semibold tracking-[0.08em] text-black/70 uppercase transition-colors hover:text-black sm:block"
              >
                Dashboard
              </Link>
              <a
                href="/auth/logout"
                className="rounded-lg bg-[#121212] px-3 py-2 text-xs font-semibold tracking-[0.08em] text-white uppercase"
              >
                Logout
              </a>
            </>
          ) : (
            <>
              <a
                href="/auth/login"
                className="hidden text-xs font-semibold tracking-[0.08em] text-black/70 uppercase transition-colors hover:text-black sm:block"
              >
                Sign In
              </a>
              <a
                href="/auth/login"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#121212] px-4 py-2 text-xs font-semibold tracking-[0.08em] text-white uppercase"
              >
                Get Started
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
