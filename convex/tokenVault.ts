/**
 * Auth0 Token Vault — Refresh Token Exchange
 *
 * Gets a fresh Google access token for a user by exchanging
 * their stored Auth0 refresh token via Token Vault.
 * Caches the access token to avoid redundant Auth0 API calls.
 *
 * Required Convex env vars:
 *   AUTH0_DOMAIN
 *   AUTH0_CLIENT_ID     — Regular web app client ID (same app as the frontend)
 *   AUTH0_CLIENT_SECRET — Regular web app client secret
 */

import { internal } from "./_generated/api"
import { ActionCtx } from "./_generated/server"
import { encrypt, decrypt } from "../lib/encryption"

export class TokenVaultError extends Error {
  public readonly isReauthRequired: boolean
  constructor(message: string, isReauthRequired: boolean) {
    super(message)
    this.name = "TokenVaultError"
    this.isReauthRequired = isReauthRequired
  }
}

const CACHE_BUFFER_MS = 5 * 60 * 1000 // Refresh 5 minutes before expiry

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

  // Retrieve stored tokens (refresh + cached access) in one query
  const tokenData = await ctx.runQuery(internal.userTokens.getCachedToken, {
    userId,
  })
  if (!tokenData) {
    throw new TokenVaultError(
      "No refresh token stored for this user. They need to use the web app first " +
        "(send an application or link Telegram) so we can capture their session token.",
      true
    )
  }

  // Return cached access token if still valid (with 5-min buffer)
  if (
    tokenData.cachedAccessToken &&
    tokenData.accessTokenExpiresAt &&
    tokenData.accessTokenExpiresAt > Date.now() + CACHE_BUFFER_MS
  ) {
    return await decrypt(tokenData.cachedAccessToken)
  }

  // Exchange the refresh token for a federated Google access token
  const res = await fetch(`https://${domain}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      subject_token: await decrypt(tokenData.auth0RefreshToken),
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
    console.error("[TokenVault] exchange failed:", res.status, err)
    const isReauth = res.status === 401 || res.status === 403
    throw new TokenVaultError(
      `Token Vault exchange failed (${res.status}): ${err}`,
      isReauth
    )
  }

  const data = await res.json()
  const accessToken: string = data.access_token
  const expiresIn: number = data.expires_in || 3600

  // Cache the new access token (encrypted)
  try {
    await ctx.runMutation(internal.userTokens.updateCachedAccessToken, {
      userId,
      cachedAccessToken: await encrypt(accessToken),
      accessTokenExpiresAt: Date.now() + expiresIn * 1000,
    })
  } catch (err) {
    console.error("[TokenVault] Failed to cache access token:", err)
  }

  return accessToken
}
