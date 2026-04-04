import { Manrope, Sora, IBM_Plex_Mono } from "next/font/google"
import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"
import { Auth0Provider } from "@auth0/nextjs-auth0/client"
import { auth0 } from "@/lib/auth0"
import { ConvexClientProvider } from "@/components/ConvexClientProvider"
import { TooltipProvider } from "@/components/ui/tooltip"

export const metadata: Metadata = {
  title: "AutoApply — AI Agent That Actually Applies For You",
  description:
    "Upload your CV, paste a job description, and let AutoApply draft personalized cover letters and send them via your own Gmail account.",
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
        <TooltipProvider>
          <Auth0Provider user={session?.user}>
            <ConvexClientProvider>
              <ThemeProvider>
                <main className="min-h-screen bg-white">{children}</main>
              </ThemeProvider>
            </ConvexClientProvider>
          </Auth0Provider>
        </TooltipProvider>
      </body>
    </html>
  )
}
