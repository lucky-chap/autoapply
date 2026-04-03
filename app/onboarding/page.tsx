import { Suspense } from "react"
import { auth0 } from "@/lib/auth0"
import { redirect } from "next/navigation"
import { OnboardingWizard } from "@/components/OnboardingWizard"

export default async function OnboardingPage() {
  const session = await auth0.getSession()
  if (!session) {
    redirect("/auth/login")
  }

  // Check if Google is already connected
  let isGoogleConnected = false
  try {
    await auth0.getAccessTokenForConnection({
      connection: "google-oauth2",
    })
    isGoogleConnected = true
  } catch {
    // Not connected yet
  }

  return (
    <div className="min-h-screen bg-white">
      <Suspense>
        <OnboardingWizard
          userId={session.user.sub!}
          userName={session.user.name ?? ""}
          isGoogleConnected={isGoogleConnected}
        />
      </Suspense>
    </div>
  )
}
