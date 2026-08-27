import type { Metadata } from "next"
import type { ReactNode } from "react"
import { Cinzel, Source_Sans_3 } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin", "latin-ext"],
})

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700"],
})

export const metadata: Metadata = {
  title: "V3 zapisy",
  description: "Zapisy gildii na V3 — sloty, pozycje i składki.",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="pl"
      className={`dark ${sourceSans.variable} ${cinzel.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
