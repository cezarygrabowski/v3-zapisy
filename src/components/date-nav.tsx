"use client"

import { useRouter } from "next/navigation"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { addDays } from "@/lib/dates"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function DateNav({
  date,
  label,
  basePath = "/",
}: {
  date: string
  label: string
  basePath?: string
}) {
  const router = useRouter()

  function go(next: string) {
    const url = basePath === "/" ? `/?d=${next}` : `${basePath}?d=${next}`
    router.push(url)
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => go(addDays(date, -1))}
          aria-label="Poprzedni dzień"
        >
          <ChevronLeftIcon />
        </Button>
        <Input
          type="date"
          value={date}
          onChange={(event) => {
            if (event.target.value) go(event.target.value)
          }}
          className="w-auto"
          aria-label="Wybierz dzień"
        />
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => go(addDays(date, 1))}
          aria-label="Następny dzień"
        >
          <ChevronRightIcon />
        </Button>
      </div>
      <p className="text-sm capitalize text-muted-foreground">{label}</p>
    </div>
  )
}
