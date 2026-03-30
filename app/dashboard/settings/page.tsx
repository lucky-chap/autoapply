"use client"

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import Link from "next/link"
import Image from "next/image"
import {
  Zap,
  ArrowLeft,
  GitBranch,
  MessageSquare,
  Mail,
  ExternalLink,
  Shield,
} from "lucide-react"

const connections = [
  {
    id: "github",
    name: "GitHub",
    icon: GitBranch,
    description:
      "Read your commits, pull requests, and issues to generate standups.",
    scopes: "repo:read, events:read",
  },
  {
    id: "slack",
    name: "Slack",
    icon: MessageSquare,
    description: "Post standup updates to your team channels.",
    scopes: "chat:write, channels:read",
  },
  {
    id: "gmail",
    name: "Gmail",
    icon: Mail,
    description:
      "Send professional standup emails. This is a high-stakes connection requiring step-up auth.",
    scopes: "gmail.compose, gmail.send",
    highStakes: true,
  },
]

export default function SettingsPage() {
  const user = useQuery(api.users.getCurrent)

  return (
    <div className="relative min-h-screen bg-neutral-100 text-neutral-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-0 h-72 w-72 rounded-full bg-white blur-3xl" />
      </div>

      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4">
          <Link
            href="/dashboard"
            className="grid h-8 w-8 place-items-center rounded-full border border-neutral-300 text-neutral-500 transition-colors hover:border-neutral-400 hover:text-neutral-900"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-black text-white">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <p className="font-display text-sm font-semibold text-neutral-900">Settings</p>
              <p className="text-xs text-neutral-500">Security and connection management</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-8 px-6 py-8">
        <section>
          <h2 className="mb-4 text-lg font-semibold text-neutral-900">Profile</h2>
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-4">
              {user?.avatarUrl ? (
                <Image
                  src={user.avatarUrl}
                  alt=""
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-full border border-neutral-200"
                />
              ) : (
                <div className="grid h-12 w-12 place-items-center rounded-full border border-neutral-200 bg-neutral-100 text-sm font-semibold text-neutral-700">
                  {(user?.name ?? "U").charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div className="font-medium text-neutral-900">{user?.name ?? "Loading..."}</div>
                <div className="text-sm text-neutral-500">{user?.email ?? ""}</div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-neutral-900">Connected Accounts</h2>
          <p className="mb-4 max-w-3xl text-sm text-neutral-500">
            Connections are managed securely via Auth0 Token Vault. Each integration uses isolated OAuth credentials with scoped permissions.
          </p>

          <div className="space-y-3">
            {connections.map((conn) => (
              <div
                key={conn.id}
                className={`rounded-2xl border bg-white p-5 shadow-sm ${
                  conn.highStakes
                    ? "border-amber-300/70 ring-1 ring-amber-100"
                    : "border-neutral-200"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-neutral-200 bg-neutral-100 text-neutral-700">
                    <conn.icon className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-neutral-900">{conn.name}</span>
                      {conn.highStakes && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          High-stakes
                        </span>
                      )}
                    </div>
                    <p className="mb-2 text-sm text-neutral-600">{conn.description}</p>
                    <div className="text-xs text-neutral-500">Scopes: {conn.scopes}</div>
                  </div>

                  <div className="hidden items-center gap-1 text-xs text-neutral-500 sm:flex">
                    <ExternalLink className="h-3 w-3" />
                    Managed by Auth0
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <Shield className="h-4 w-4 text-neutral-700" />
              <h3 className="text-sm font-semibold text-neutral-900">How Token Vault Works</h3>
            </div>
            <p className="text-sm text-neutral-600">
              DevStandup AI never stores your OAuth tokens directly. Auth0 Token Vault securely manages credential exchange. When an agent needs access, it requests a scoped token through the vault so you can review permissions before action execution.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
