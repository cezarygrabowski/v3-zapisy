"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { stopImpersonation } from "@/lib/actions/impersonation"
import { LogOut } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

export function ImpersonationBanner({
  realNick,
  impersonatedNick,
  impersonatedPlaystyle,
}: {
  realNick: string
  impersonatedNick: string
  impersonatedPlaystyle?: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleStop() {
    startTransition(async () => {
      const res = await stopImpersonation()
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
      router.push("/admin")
      router.refresh()
    })
  }

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-amber-500/40 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 px-4 py-2 text-amber-950 shadow-md backdrop-blur-md dark:from-amber-600 dark:via-amber-500 dark:to-amber-600 dark:text-zinc-950">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-base select-none">🎭</span>
        <div className="flex items-center gap-2 flex-wrap text-xs font-semibold">
          <span>Wcielasz się w gracza:</span>
          <Badge className="bg-amber-950 text-white dark:bg-black text-[11px] px-2 py-0.5 font-bold shadow-xs">
            {impersonatedNick}
          </Badge>
          {impersonatedPlaystyle ? (
            <Badge variant="outline" className="border-amber-900/40 text-amber-950 dark:text-black text-[10px] uppercase font-bold">
              {impersonatedPlaystyle}
            </Badge>
          ) : null}
          <span className="opacity-80 hidden sm:inline">
            (Prawdziwe konto: <strong>{realNick}</strong>)
          </span>
        </div>
      </div>

      <Button
        size="xs"
        variant="secondary"
        onClick={handleStop}
        disabled={pending}
        className="h-7 shrink-0 gap-1.5 bg-amber-950 text-white hover:bg-amber-900 dark:bg-black dark:hover:bg-zinc-900 dark:text-white text-xs font-semibold shadow-xs cursor-pointer"
      >
        {pending ? <Spinner className="h-3.5 w-3.5" /> : <LogOut className="h-3.5 w-3.5" />}
        <span>Wróć do swojego konta</span>
      </Button>
    </div>
  )
}
