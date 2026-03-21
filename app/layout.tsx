import { Roboto, Montserrat, PT_Mono } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"
import { Auth0Provider } from "@auth0/nextjs-auth0/client"
import { auth0 } from "@/lib/auth0"
import { ConvexClientProvider } from "@/components/ConvexClientProvider"
import { Navbar } from "@/components/navbar"

const roboto = Roboto({
  weight: ["100", "300", "400", "500", "700", "900"],
  subsets: ["latin"],
  variable: "--font-sans",
})

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-display",
})

const fontMono = PT_Mono({
  weight: "400",
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
        roboto.variable,
        montserrat.variable,
        fontMono.variable,
        "font-sans"
      )}
    >
      <body>
        <Auth0Provider user={session?.user}>
          <ConvexClientProvider>
            <ThemeProvider>
              <Navbar />
              <main className="min-h-[calc(100vh-64px)] bg-background">
                {children}
              </main>
            </ThemeProvider>
          </ConvexClientProvider>
        </Auth0Provider>
      </body>
    </html>
  )
}
