/**
 * Auth0 Management API helpers — user info lookups.
 *
 * These are NOT part of Token Vault. They use a separate M2M app
 * to call Auth0's Management API for display purposes (e.g. showing
 * which email is linked in Telegram).
 *
 * Required Convex env vars:
 *   AUTH0_DOMAIN
 *   AUTH0_M2M_CLIENT_ID
 *   AUTH0_M2M_CLIENT_SECRET
 */

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
