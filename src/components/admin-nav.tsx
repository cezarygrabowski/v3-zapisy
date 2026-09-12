"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export function AdminNav() {
  const pathname = usePathname()

  const tabs = [
    {
      href: "/admin",
      label: "👥 Użytkownicy i kary",
      exact: true,
    },
    {
      href: "/admin/konfiguracja",
      label: "⚙️ Konfiguracja",
      exact: false,
    },
    {
      href: "/regulamin",
      label: "📜 Regulamin",
      exact: true,
    },
  ]

  return (
    <div className="flex items-center gap-1.5 border-b pb-3">
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all",
              active
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </div>
  )
}
