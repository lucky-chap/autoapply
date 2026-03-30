import { Auth0Client } from "@auth0/nextjs-auth0/server"

export const auth0 = new Auth0Client({
  enableConnectAccountEndpoint: true,
  routes: {
    login: "/auth/login",
    callback: "/auth/callback",
    logout: "/auth/logout",
    connectAccount: "/auth/connect",
  },
})

export const getRefreshToken = async () => {
  const session = await auth0.getSession()
  return session?.tokenSet?.refreshToken
}

export const getUser = async () => {
  const session = await auth0.getSession()
  return session?.user
}
