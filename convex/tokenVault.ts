/**
 * Auth0 Token Vault — Refresh Token Exchange
 *
 * Gets a fresh Google access token for a user by exchanging
 * their stored Auth0 refresh token via Token Vault.
 *
 * Required Convex env vars:
 *   AUTH0_DOMAIN
 *   AUTH0_CLIENT_ID     — Regular web app client ID (same app as the frontend)
 *   AUTH0_CLIENT_SECRET — Regular web app client secret
 *   AUTH0_M2M_CLIENT_ID     — M2M app for Management API lookups
 *   AUTH0_M2M_CLIENT_SECRET
 */

import { internal } from "./_generated/api"
import { ActionCtx } from "./_generated/server"

// ── Token Vault: refresh token → federated Google access token ──

export async function getGmailTokenViaTokenVault(
  ctx: ActionCtx,
  userId: string
): Promise<string> {
  const domain = process.env.AUTH0_DOMAIN
  const clientId = process.env.AUTH0_CLIENT_ID
  const clientSecret = process.env.AUTH0_CLIENT_SECRET

  if (!domain || !clientId || !clientSecret) {
    throw new Error(
      "Token Vault not configured. Set AUTH0_DOMAIN, AUTH0_CLIENT_ID, " +
        "and AUTH0_CLIENT_SECRET in Convex env vars."
    )
  }

  // Retrieve stored Auth0 refresh token for this user
  const refreshToken = await ctx.runQuery(internal.userTokens.getRefreshToken, {
    userId,
  })
  if (!refreshToken) {
    throw new Error(
      "No refresh token stored for this user. They need to use the web app first " +
        "(send an application or link Telegram) so we can capture their session token."
    )
  }

  // Exchange the refresh token for a federated Google access token
  const res = await fetch(`https://${domain}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      subject_token: refreshToken,
      grant_type:
        "urn:auth0:params:oauth:grant-type:token-exchange:federated-connection-access-token",
      subject_token_type: "urn:ietf:params:oauth:token-type:refresh_token",
      requested_token_type:
        "http://auth0.com/oauth/token-type/federated-connection-access-token",
      connection: "google-oauth2",
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Token Vault exchange failed (${res.status}): ${err}`)
  }

  const data = await res.json()
  return data.access_token
}

// ── Helper: get Auth0 Management API token (for user info lookups) ──

export async function getAuth0ManagementToken(): Promise<string> {
  const domain = process.env.AUTH0_DOMAIN!
  const clientId = process.env.AUTH0_M2M_CLIENT_ID!
  const clientSecret = process.env.AUTH0_M2M_CLIENT_SECRET!

  const res = await fetch(`https://${domain}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      audience: `https://${domain}/api/v2/`,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Auth0 M2M token error (${res.status}): ${err}`)
  }
  const data = await res.json()
  return data.access_token
}

// ── Helper: get user email/name from Auth0 ──

export async function getUserEmail(
  managementToken: string,
  userId: string
): Promise<{ name: string; email: string } | null> {
  const domain = process.env.AUTH0_DOMAIN!
  const res = await fetch(
    `https://${domain}/api/v2/users/${encodeURIComponent(userId)}?fields=name,email`,
    { headers: { Authorization: `Bearer ${managementToken}` } }
  )
  if (!res.ok) return null
  const data = await res.json()
  return data.name && data.email ? { name: data.name, email: data.email } : null
}
