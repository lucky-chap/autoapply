/**
 * Configures Multi-Resource Refresh Token (MRRT) policies on the Auth0 application.
 * This is required for the connect account flow (linking Google OAuth via Token Vault).
 *
 * Run: npm run setup
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

const required = ["AUTH0_DOMAIN", "AUTH0_CLIENT_ID", "AUTH0_CLIENT_SECRET"] as const

const missing = required.filter((key) => !process.env[key])
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`)
  console.error("Make sure your .env file is loaded or these variables are set.")
  process.exit(1)
}

const domain = process.env
  .AUTH0_DOMAIN!.replace(/^https?:\/\//, "")
  .replace(/\/$/, "")
const clientId = process.env.AUTH0_CLIENT_ID!
const clientSecret = process.env.AUTH0_CLIENT_SECRET!
const issuer = `https://${domain}`
const meAudience = `${issuer}/me/`

async function getManagementToken(): Promise<string> {
  const res = await fetch(`${issuer}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      audience: `${issuer}/api/v2/`,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`Failed to get Management API token (${res.status}):`, body)
    console.error(
      "\nMake sure your app is authorized on the Auth0 Management API with read:clients and update:clients scopes."
    )
    process.exit(1)
  }

  const { access_token } = await res.json()
  return access_token
}

async function getCurrentConfig(token: string) {
  const res = await fetch(
    `${issuer}/api/v2/clients/${clientId}?fields=refresh_token`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!res.ok) {
    const body = await res.text()
    console.error(`Failed to read client config (${res.status}):`, body)
    process.exit(1)
  }

  return res.json()
}

async function patchClient(token: string) {
  const res = await fetch(`${issuer}/api/v2/clients/${clientId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      refresh_token: {
        rotation_type: "non-rotating",
        expiration_type: "expiring",
        token_lifetime: 31557600,
        idle_token_lifetime: 2592000,
        infinite_token_lifetime: false,
        infinite_idle_token_lifetime: false,
        policies: [
          {
            audience: meAudience,
            scope: ["create:me:connected_accounts"],
          },
        ],
      },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`Failed to update client config (${res.status}):`, body)
    console.error(
      "\nMake sure your app has the update:clients scope on the Auth0 Management API."
    )
    process.exit(1)
  }

  return res.json()
}

async function main() {
  console.log(`Configuring MRRT for ${clientId} on ${domain}...\n`)

  const token = await getManagementToken()
  console.log("Got Management API token.")

  const current = await getCurrentConfig(token)
  const policies = current.refresh_token?.policies ?? []
  const alreadyConfigured = policies.some(
    (p: { audience: string }) => p.audience === meAudience
  )
  const isNonRotating = current.refresh_token?.rotation_type === "non-rotating"

  if (alreadyConfigured && isNonRotating) {
    console.log(
      `\nMRRT policy for ${meAudience} is already configured with non-rotating refresh tokens. Nothing to do.`
    )
    process.exit(0)
  }

  if (alreadyConfigured && !isNonRotating) {
    console.log(`\nMRRT policy exists but rotation_type is "${current.refresh_token?.rotation_type}". Updating to "non-rotating"...`)
  }

  await patchClient(token)
  console.log(`\nMRRT policy configured successfully.`)
  console.log(`  Audience: ${meAudience}`)
  console.log(`  Scope:    create:me:connected_accounts`)
  console.log(
    `\nIMPORTANT: Log out and log back in to get a fresh session with the updated token set.`
  )
}

main().catch((err) => {
  console.error("Unexpected error:", err)
  process.exit(1)
})
