"use client"
import type { ReactNode } from "react"

export type AuthComponentMode = "redirect" | "popup" | "auto"

export type TokenVaultAuthProps = {
  interrupt: {
    connection: string
    requiredScopes: string[]
    authorizationParams?: Record<string, string>
    resume?: () => void
  }
  auth?: {
    connectPath?: string
    returnTo?: string
  }
  onFinish?: () => void
  connectWidget: {
    icon?: ReactNode
    title: string
    description: string
    action?: { label: string }
    containerClassName?: string
  }
  mode?: AuthComponentMode
}
