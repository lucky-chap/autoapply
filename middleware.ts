import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { auth0 } from "@/lib/auth0"

export async function middleware(request: NextRequest) {
  const authRes = await auth0.middleware(request)

  // Let Auth0 handle /auth/* routes (login, callback, logout, connect, etc.)
  if (request.nextUrl.pathname.startsWith("/auth")) {
    return authRes
  }

  // Protect dashboard routes — redirect to login if no session
  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    const session = await auth0.getSession(request)
    if (!session) {
      const origin = request.nextUrl.origin
      return NextResponse.redirect(`${origin}/auth/login`)
    }
  }

  return authRes
}

export const config = {
  matcher: [
    "/auth/:path*",
    "/dashboard/:path*",
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
}
