"use client"

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export function OnboardingGuard({
  userId,
  children,
}: {
  userId: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const settings = useQuery(api.userSettings.getByUser, { userId })

  useEffect(() => {
    // Wait for the query to load
    if (settings === undefined) return

    // If no settings record or onboarding not completed, redirect
    if (!settings || !settings.onboardingCompleted) {
      router.replace("/onboarding")
    }
  }, [settings, router])

  // While loading or redirecting, show nothing
  if (settings === undefined || !settings?.onboardingCompleted) {
    return null
  }

  return <>{children}</>
}
