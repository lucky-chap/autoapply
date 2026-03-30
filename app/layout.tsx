import { Manrope, Sora, IBM_Plex_Mono } from "next/font/google"
import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"
import { Auth0Provider } from "@auth0/nextjs-auth0/client"
import { auth0 } from "@/lib/auth0"
import { ConvexClientProvider } from "@/components/ConvexClientProvider"
import { Toaster } from "sonner"

export const metadata: Metadata = {
  title: "DevStandup AI — AI Actions You Actually Approve",
  description:
    "Turn your developer activity into AI-proposed actions across Slack and Gmail. Every operation is visible, explainable, and user-approved.",
}

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
})

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-display",
})

const fontMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-mono",
})

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await auth0.getSession()

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        manrope.variable,
        sora.variable,
        fontMono.variable,
        "font-sans"
      )}
    >
      <body>
        <Auth0Provider user={session?.user}>
          <ConvexClientProvider>
            <ThemeProvider>
              <main className="min-h-screen bg-neutral-50 text-neutral-900">
                {children}
              </main>
              <Toaster theme="light" />
            </ThemeProvider>
          </ConvexClientProvider>
        </Auth0Provider>
      </body>
    </html>
  )
}
