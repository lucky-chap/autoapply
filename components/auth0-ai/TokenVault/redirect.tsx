"use client"

import { PromptUserContainer } from "../util/prompt-user-container"

import type { TokenVaultAuthProps } from "./TokenVaultAuthProps"

export function TokenVaultConsentRedirect({
  interrupt: { connection, requiredScopes, authorizationParams },
  connectWidget: { icon, title, description, action, containerClassName },
  auth: {
    connectPath = "/auth/connect",
    returnTo = typeof window !== "undefined" ? window.location.pathname : "/",
  } = {},
}: TokenVaultAuthProps) {
  return (
    <PromptUserContainer
      title={title}
      description={description}
      icon={icon}
      containerClassName={containerClassName}
      action={{
        label: action?.label ?? "Connect",
        onClick: () => {
          const search = new URLSearchParams({
            connection,
            returnTo,
            ...authorizationParams,
          })
          for (const requiredScope of requiredScopes) {
            search.append("scopes", requiredScope)
          }

          const url = new URL(connectPath, window.location.origin)
          url.search = search.toString()
          window.location.href = url.toString()
        },
      }}
    />
  )
}
