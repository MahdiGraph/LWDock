import type { Metadata } from "next"
import { Libre_Franklin, Source_Serif_4 } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

// Everything reads the session or the database, so nothing is prerendered.
export const dynamic = "force-dynamic"

const franklin = Libre_Franklin({ subsets: ["latin"], variable: "--font-franklin", display: "swap" })
const sourceSerif = Source_Serif_4({ subsets: ["latin"], variable: "--font-source-serif", display: "swap" })

export const metadata: Metadata = {
  title: { default: "Leaseweb Dock", template: "%s · Leaseweb Dock" },
  description: "Self-hosted panel for sharing Leaseweb servers with the people who use them.",
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${franklin.variable} ${sourceSerif.variable} h-full`}>
      <body className="min-h-full">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider delayDuration={300}>
            {children}
            <Toaster position="bottom-right" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
