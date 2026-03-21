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
})
