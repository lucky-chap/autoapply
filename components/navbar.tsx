import Link from "next/link"
import { auth0 } from "@/lib/auth0"

export async function Navbar() {
  const session = await auth0.getSession()
  const user = session?.user

  return (
    <nav className="sticky top-0 z-50 border-b bg-surface">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link
          href="/"
          className="font-display text-xl font-bold tracking-tight text-primary"
        >
          AutoApply
        </Link>

        <div className="flex items-center gap-6">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="text-sm font-medium text-text transition-colors hover:text-primary"
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard/new"
                className="text-sm font-medium text-text transition-colors hover:text-primary"
              >
                New Application
              </Link>
              <Link
                href="/permissions"
                className="text-sm font-medium text-text transition-colors hover:text-primary"
              >
                Permissions
              </Link>
              <div className="flex items-center gap-3 border-l pl-6">
                <div className="hidden text-right sm:block">
                  <p className="text-xs leading-none font-semibold text-primary">
                    {user.name}
                  </p>
                  <p className="mt-1 text-[10px] text-gray-500">{user.email}</p>
                </div>
                {user.picture && (
                  <img
                    src={user.picture}
                    alt={user.name}
                    className="h-8 w-8 rounded-full border shadow-sm"
                  />
                )}
                <a
                  href="/auth/logout"
                  className="rounded-md border border-danger/20 px-3 py-1.5 text-xs font-semibold text-danger transition-all hover:bg-danger/5"
                >
                  Logout
                </a>
              </div>
            </>
          ) : (
            <a
              href="/auth/login"
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90"
            >
              Get Started
            </a>
          )}
        </div>
      </div>
    </nav>
  )
}
