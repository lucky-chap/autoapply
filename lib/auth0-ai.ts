import { Auth0AI, getAccessTokenFromTokenVault } from "@auth0/ai-vercel"

import { getRefreshToken } from "./auth0"

export const getAccessToken = async () => getAccessTokenFromTokenVault()

const auth0AI = new Auth0AI()

// GitHub connection — repo scope needed to read private repo activity
export const withGitHub = auth0AI.withTokenVault({
  connection: "github",
  scopes: ["repo"],
  refreshToken: getRefreshToken,
  credentialsContext: "tool-call",
})

// Google OAuth2 — Gmail compose + send (high-stakes)
export const withGmailWrite = auth0AI.withTokenVault({
  connection: "google-oauth2",
  scopes: [
    "openid",
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/gmail.send",
  ],
  refreshToken: getRefreshToken,
})

// Slack connection
export const withSlack = auth0AI.withTokenVault({
  connection: "sign-in-with-slack",
  scopes: ["chat:write", "channels:read"],
  refreshToken: getRefreshToken,
})
