import { auth0 } from "@/lib/auth0"
import { redirect } from "next/navigation"
import Link from "next/link"
import {
  Shield,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  PlusCircle,
  RefreshCw,
  ArrowLeft,
} from "lucide-react"

// These are the scopes we want to verify are present
const REQUIRED_SCOPES = [
  {
    id: "gmail.send",
    name: "Gmail — Send",
    scope: "https://www.googleapis.com/auth/gmail.send",
    description:
      "Allows the agent to send application emails using your identity.",
  },
  {
    id: "gmail.readonly",
    name: "Gmail — Read",
    scope: "https://www.googleapis.com/auth/gmail.readonly",
    description:
      "Allows the agent to check for recruiter replies in your inbox.",
  },
  {
    id: "calendar.events",
    name: "Google Calendar — Events",
    scope: "https://www.googleapis.com/auth/calendar.events",
    description:
      "Allows the agent to check for scheduling conflicts and create interview events.",
  },
]

export default async function PermissionsPage() {
  const session = await auth0.getSession()
  if (!session) {
    redirect("/auth/login")
  }

  // Check if Google is connected by retrieving the connection token
  let isConnected = false
  let grantedScopes: string[] = []
  try {
    const connectionToken = (await auth0.getAccessTokenForConnection({
      connection: "google-oauth2",
    })) as { token: string; expiresAt: number; scope?: string }
    isConnected = true
    grantedScopes = connectionToken.scope?.split(" ") || []
  } catch (err) {
    console.error("[permissions] getAccessTokenForConnection failed:", err)
  }

  // Check which of our required scopes are actually granted
  const scopeStatus = REQUIRED_SCOPES.map((rs) => ({
    ...rs,
    isGranted: grantedScopes.includes(rs.scope),
    status:
      isConnected && grantedScopes.includes(rs.scope) ? "Active" : "Missing",
  }))

  const scopes = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/calendar.events",
  ]
  const scopeParams = scopes
    .map((s) => `scopes=${encodeURIComponent(s)}`)
    .join("&")
  const connectUrl = `/auth/connect?connection=google-oauth2&prompt=consent&${scopeParams}`

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <Link
        href="/dashboard"
        className="group mb-4 inline-flex items-center gap-2 text-sm font-medium text-black/50 transition-colors hover:text-black"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
        Back to Dashboard
      </Link>

      <div className="mb-10">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-black sm:text-5xl md:leading-[1.1]">
          Security & Permissions
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-black/60 sm:text-base">
          AutoApply operates with zero passwords. We use delegated OAuth tokens
          via Auth0 Token Vault for secure access.
        </p>
      </div>

      <div className="grid gap-6">
        <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-50 bg-gray-50/50 p-6">
            <h2 className="flex items-center gap-2 font-bold text-primary">
              <CheckCircle2
                className={`h-5 w-5 ${isConnected ? "text-green-500" : "text-gray-300"}`}
              />
              Connected Google Services
            </h2>
            <div className="flex items-center gap-2">
              {!isConnected ? (
                <a
                  href={connectUrl}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  Connect Google
                </a>
              ) : (
                <a
                  href={connectUrl}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 transition-colors hover:bg-gray-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Re-authorize
                </a>
              )}
            </div>
          </div>

          <div className="divide-y divide-gray-50">
            {scopeStatus.map((item) => (
              <div
                key={item.id}
                className="flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center"
              >
                <div className="max-w-md">
                  <div className="mb-1 flex items-center gap-2">
                    <p className="font-bold text-primary">{item.name}</p>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
                      {item.id}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-gray-500">
                    {item.description}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                      item.isGranted
                        ? "bg-green-50 text-green-600"
                        : "bg-gray-50 text-gray-400"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        item.isGranted ? "bg-green-500" : "bg-gray-300"
                      }`}
                    ></span>
                    {item.status}
                  </span>
                  {isConnected && !item.isGranted && (
                    <a
                      href={connectUrl}
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90"
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      Connect
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {!isConnected && (
            <div className="border-t border-gray-50 bg-gray-50/30 p-8 text-center">
              <p className="text-sm text-gray-500">
                Google services are not connected yet. Grant access so AutoApply
                can send emails and check your calendar.
              </p>
              <a
                href={connectUrl}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
              >
                Connect Google Services
              </a>
            </div>
          )}
        </section>

        <div className="flex gap-4 rounded-2xl border border-amber-100 bg-amber-50 p-6">
          <AlertCircle className="h-6 w-6 shrink-0 text-amber-600" />
          <div>
            <h3 className="mb-1 font-bold text-amber-900">
              Implicit Security Design
            </h3>
            <p className="text-sm leading-relaxed text-amber-800">
              AutoApply never sees your Gmail password. We only hold short-lived
              "permission slips" (OAuth tokens). You can revoke access at any
              time from your Google Account security settings.
            </p>
            <a
              href="https://auth0.com/docs/secure/tokens/token-vault"
              target="_blank"
              className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:underline"
            >
              Learn about Token Vault
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>

      <div className="mt-12 text-center">
        <button className="text-sm font-semibold text-gray-400 transition-colors hover:text-primary">
          Download Security Manifest (JSON)
        </button>
      </div>
    </div>
  )
}
