"use client"

import { signOut } from "next-auth/react"
import { ShieldAlert, LogOut, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export function VerificationPendingView({
  gameNick,
  discordName,
}: {
  gameNick: string
  discordName: string
}) {
  return (
    <div className="flex min-h-[75vh] items-center justify-center p-4">
      <Card className="max-w-md w-full border-amber-500/30 bg-card/80 backdrop-blur-md shadow-xl text-center">
        <CardHeader className="flex flex-col items-center gap-3 pb-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/30 shadow-inner">
            <Clock className="h-7 w-7 animate-pulse" />
          </div>
          <CardTitle className="font-heading text-xl font-bold tracking-tight">
            Konto oczekuje na weryfikację
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground max-w-sm">
            Witaj, <strong className="text-foreground">{gameNick}</strong> ({discordName})! Twoje konto zostało utworzone, jednak wymaga jeszcze zatwierdzenia przez lidera gildii.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3 text-xs text-muted-foreground pt-0">
          <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 text-left space-y-2">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0" />
              <span>Dostęp ograniczony</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Ze względów bezpieczeństwa dane taktyczne, kalendarz oraz timery są widoczne dopiero po pomyślnej weryfikacji. Skontaktuj się z liderem lub administratorem na Discordzie.
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-2 cursor-pointer"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Wyloguj się</span>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
