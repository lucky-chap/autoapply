/**
 * Registers the Telegram bot webhook with Convex.
 *
 * Prerequisites:
 *   1. Create a bot via @BotFather on Telegram and copy the token
 *   2. Set Convex env vars:
 *        npx convex env set TELEGRAM_BOT_TOKEN <your-bot-token>
 *        npx convex env set TELEGRAM_WEBHOOK_SECRET <random-secret>
 *      Generate a secret with: openssl rand -hex 32
 *
 * Run: npm run setup:telegram
 */

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

// Load .env.local (Next.js convention) since tsx doesn't do it automatically
for (const file of [".env.local", ".env"]) {
  try {
    const content = readFileSync(resolve(process.cwd(), file), "utf-8")
    for (const line of content.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eqIndex = trimmed.indexOf("=")
      if (eqIndex === -1) continue
      const key = trimmed.slice(0, eqIndex).trim()
      const value = trimmed.slice(eqIndex + 1).trim()
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  } catch {
    // file doesn't exist, skip
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(`Missing required environment variable: ${name}`)
    console.error(
      name === "TELEGRAM_BOT_TOKEN"
        ? "Create a bot via @BotFather on Telegram and set: npx convex env set TELEGRAM_BOT_TOKEN <token>"
        : name === "TELEGRAM_WEBHOOK_SECRET"
          ? "Generate a secret with: openssl rand -hex 32\nThen set: npx convex env set TELEGRAM_WEBHOOK_SECRET <secret>"
          : `Set it with: npx convex env set ${name} <value>`
    )
    process.exit(1)
  }
  return value
}

async function main() {
  const convexUrl =
    process.env.CONVEX_URL ||
    process.env.NEXT_PUBLIC_CONVEX_URL
  if (!convexUrl) {
    console.error("Missing CONVEX_URL or NEXT_PUBLIC_CONVEX_URL in environment.")
    process.exit(1)
  }
  const botToken = requireEnv("TELEGRAM_BOT_TOKEN")
  const webhookSecret = requireEnv("TELEGRAM_WEBHOOK_SECRET")

  // CONVEX_URL is https://<deployment>.convex.cloud
  // HTTP actions are served from .site
  const siteUrl = convexUrl.replace(/\.cloud$/, ".site")
  const webhookUrl = `${siteUrl}/telegram/webhook`

  console.log(`Registering Telegram webhook...`)
  console.log(`  Bot token:    ${botToken.slice(0, 8)}...`)
  console.log(`  Webhook URL:  ${webhookUrl}\n`)

  const res = await fetch(
    `https://api.telegram.org/bot${botToken}/setWebhook`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: webhookSecret,
      }),
    }
  )

  const data = await res.json()

  if (!res.ok || !data.ok) {
    console.error(`Telegram API error (${res.status}):`, data)
    process.exit(1)
  }

  console.log(`Webhook registered successfully.`)
  console.log(`  ${data.description}`)
}

main().catch((err) => {
  console.error("Unexpected error:", err)
  process.exit(1)
})
