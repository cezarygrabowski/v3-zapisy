"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { logout } from "@/lib/actions/auth"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"

const LINKS = [
  { href: "/run", label: "Run" },
  { href: "/", label: "Zapisy" },
  { href: "/skladki", label: "Składki" },
  { href: "/statystyki", label: "Statystyki" },
  { href: "/regulamin", label: "Regulamin" },
  { href: "/konto", label: "Konto" },
]

export function AppNav({
  nick,
  isLeader,
  pendingPayments = 0,
}: {
  nick: string
  isLeader: boolean
  pendingPayments?: number
}) {
  const pathname = usePathname()
  const links = isLeader
    ? [...LINKS, { href: "/admin", label: "Admin" }]
    : LINKS

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-heading text-base font-semibold">
            V3 zapisy
          </Link>
          {isLeader ? <Badge variant="secondary">Admin</Badge> : null}
        </div>
        <nav className="flex flex-wrap items-center gap-1">
          {links.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(buttonVariants({ variant: active ? "secondary" : "ghost", size: "sm" }))}
              >
                {link.label}
                {link.href === "/skladki" && pendingPayments > 0 ? (
                  <Badge variant="secondary" className="ml-1.5">
                    {pendingPayments}
                  </Badge>
                ) : null}
              </Link>
            )
          })}
        </nav>
        <div className="flex items-center gap-2">
          <span className={cn("truncate text-sm text-muted-foreground")}>{nick}</span>
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm">
              Wyloguj
            </Button>
          </form>
        </div>
      </div>
    </header>
  )
}
