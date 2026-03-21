import { auth0 } from "@/lib/auth0"
import { NextResponse } from "next/server"
import crypto from "node:crypto"

export async function GET() {
  const session = await auth0.getSession()
  if (!session) {
    return NextResponse.json({ error: "No session" }, { status: 401 })
  }

  const domain = process.env
    .AUTH0_DOMAIN!.replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
  const issuer = `https://${domain}`

  try {
    const tokenRes = (await auth0.getAccessToken({
      audience: `${issuer}/me/`,
      scope: "create:me:connected_accounts",
    })) as { token: string }

    // Generate a proper code_challenge like the SDK would
    const codeVerifier = crypto.randomBytes(32).toString("base64url")
    const codeChallenge = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest("base64url")

    const res = await fetch(`${issuer}/me/v1/connected-accounts/connect`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenRes.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        connection: "google-oauth2",
        redirect_uri: `${process.env.APP_BASE_URL}/auth/callback`,
        state: crypto.randomBytes(16).toString("hex"),
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        scopes: [
          "https://www.googleapis.com/auth/gmail.send",
          "https://www.googleapis.com/auth/gmail.readonly",
        ],
        authorization_params: { prompt: "consent" },
      }),
    })

    const body = await res.text()
    return NextResponse.json({
      status: res.status,
      body: (() => {
        try {
          return JSON.parse(body)
        } catch {
          return body
        }
      })(),
    })
  } catch (e: unknown) {
    const err = e as Error & { code?: string }
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: 500 }
    )
  }
}
