import { Auth0Client } from "@auth0/nextjs-auth0/server"

const domain = process.env
  .AUTH0_DOMAIN!.replace(/^https?:\/\//, "")
  .replace(/\/$/, "")

export const auth0 = new Auth0Client({
  domain,
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
  secret: process.env.AUTH0_SECRET!,
  appBaseUrl: process.env.APP_BASE_URL!,
  enableConnectAccountEndpoint: true,
  httpTimeout: 10000,
  authorizationParameters: {
    scope: "openid profile email offline_access",
  },
})

// Get the refresh token from Auth0 session
export const getRefreshToken = async () => {
  const session = await auth0.getSession()
  const tokenSet = session?.tokenSet as any
  return tokenSet?.refresh_token || tokenSet?.refreshToken
}

export const getUser = async () => {
  const session = await auth0.getSession()
  return session?.user
}

