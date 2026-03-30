"use client"

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import Link from "next/link"
import {
  Zap,
  ArrowLeft,
  GitBranch,
  MessageSquare,
  Mail,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"

const connections = [
  {
    id: "github",
    name: "GitHub",
    icon: GitBranch,
    description:
      "Read your commits, pull requests, and issues to generate standups.",
    scopes: "repo:read, events:read",
    color: "bg-zinc-500/20 text-zinc-400",
  },
  {
    id: "slack",
    name: "Slack",
    icon: MessageSquare,
    description: "Post standup updates to your team channels.",
    scopes: "chat:write, channels:read",
    color: "bg-purple-500/20 text-purple-400",
  },
  {
    id: "gmail",
    name: "Gmail",
    icon: Mail,
    description:
      "Send professional standup emails. This is a high-stakes connection requiring step-up auth.",
    scopes: "gmail.compose, gmail.send",
    color: "bg-amber-500/20 text-amber-400",
    highStakes: true,
  },
]

export default function SettingsPage() {
  const user = useQuery(api.users.getCurrent)

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="border-b border-zinc-800 px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span className="font-display font-bold text-white">Settings</span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Profile */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">Profile</h2>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-center gap-4">
              {user?.avatarUrl && (
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="w-12 h-12 rounded-full"
                />
              )}
              <div>
                <div className="text-white font-medium">
                  {user?.name ?? "Loading..."}
                </div>
                <div className="text-sm text-zinc-400">{user?.email}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Connections */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-2">
            Connected Accounts
          </h2>
          <p className="text-sm text-zinc-400 mb-4">
            Connections are managed securely via Auth0 Token Vault. Each
            connection uses isolated OAuth credentials with scoped permissions.
          </p>
          <div className="space-y-3">
            {connections.map((conn) => (
              <div
                key={conn.id}
                className={`rounded-lg border p-5 ${
                  conn.highStakes
                    ? "border-amber-500/30 bg-amber-500/5"
                    : "border-zinc-800 bg-zinc-900"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${conn.color}`}
                  >
                    <conn.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white">
                        {conn.name}
                      </span>
                      {conn.highStakes && (
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
                          High-stakes
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-400 mb-2">
                      {conn.description}
                    </p>
                    <div className="text-xs text-zinc-500">
                      Scopes: {conn.scopes}
                    </div>
                  </div>
                  <div className="text-xs text-zinc-500 flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" />
                    Managed by Auth0
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Info */}
        <section>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
            <h3 className="text-sm font-medium text-white mb-2">
              How Token Vault Works
            </h3>
            <p className="text-sm text-zinc-400">
              DevStandup AI never stores your OAuth tokens directly. Auth0 Token
              Vault securely manages credential exchange. When an agent needs
              access, it requests a scoped token through the vault — and you see
              exactly which permission is requested and why.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
