"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Spinner } from "@/components/ui/spinner"
import {
  testDiscordWebhook,
  triggerDailyEventsNotificationNow,
  triggerEnemyAlertNotificationNow,
  triggerFeeReminderNotificationNow,
  updateDiscordSettings,
} from "@/lib/actions/discord"
import type { DiscordConfig } from "@/lib/discord-types"
import {
  Bell,
  Calendar,
  Coins,
  Send,
  ShieldAlert,
  Sparkles,
  Check,
  AlertCircle,
} from "lucide-react"

const DAYS_OF_WEEK = [
  { value: 1, label: "Poniedziałek" },
  { value: 2, label: "Wtorek (przed auto-lockiem)" },
  { value: 3, label: "Środa" },
  { value: 4, label: "Czwartek" },
  { value: 5, label: "Piątek" },
  { value: 6, label: "Sobota" },
  { value: 7, label: "Niedziela" },
]

export function AdminDiscordSettings({
  initialConfig,
}: {
  initialConfig: DiscordConfig
}) {
  const [config, setConfig] = useState<DiscordConfig>(initialConfig)
  const [pending, startTransition] = useTransition()
  const [testPending, setTestPending] = useState(false)
  const [dailyPending, setDailyPending] = useState(false)
  const [feePending, setFeePending] = useState(false)
  const [enemyPending, setEnemyPending] = useState(false)

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await updateDiscordSettings(config)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
    })
  }

  async function handleTestWebhook() {
    if (!config.webhookUrl) {
      toast.error("Wprowadź najpierw adres Discord Webhook URL.")
      return
    }
    setTestPending(true)
    try {
      const res = await testDiscordWebhook(config.webhookUrl)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
    } finally {
      setTestPending(false)
    }
  }

  async function handleTriggerDaily() {
    setDailyPending(true)
    try {
      const res = await triggerDailyEventsNotificationNow()
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
    } finally {
      setDailyPending(false)
    }
  }

  async function handleTriggerFees() {
    setFeePending(true)
    try {
      const res = await triggerFeeReminderNotificationNow()
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
    } finally {
      setFeePending(false)
    }
  }

  async function handleTriggerEnemyAlert() {
    setEnemyPending(true)
    try {
      const res = await triggerEnemyAlertNotificationNow()
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.message)
    } finally {
      setEnemyPending(false)
    }
  }

  return (
    <Card className="border shadow-xs">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#5865F2]/10 text-[#5865F2]">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                Integracja z Discordem: Powiadomienia bota
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Automatyczne wysyłanie planu dnia z listą osób oraz przypomnień o składkach na wybrany kanał Discord.
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-6 text-sm">
        {/* Webhook URL configuration */}
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3.5">
          <Label htmlFor="discord-webhook" className="font-semibold flex items-center justify-between">
            <span>Discord Webhook URL</span>
            <span className="text-xs text-muted-foreground font-normal">
              Ustawienia kanału na Discordzie → Integracje → Webhooki
            </span>
          </Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="discord-webhook"
              placeholder="https://discord.com/api/webhooks/..."
              value={config.webhookUrl}
              onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
              className="font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestWebhook}
              disabled={testPending || !config.webhookUrl}
              className="shrink-0"
            >
              {testPending ? <Spinner className="mr-1.5 h-3.5 w-3.5" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
              Test połączenia
            </Button>
          </div>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-6">
          {/* Sekcja 1: Codzienny spis wydarzeń */}
          <div className="rounded-lg border p-4 flex flex-col gap-4 bg-background">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <div>
                  <h4 className="font-semibold text-sm">1. Codzienny spis wydarzeń i lista obecności</h4>
                  <p className="text-xs text-muted-foreground">
                    Każdego ranka wysyła listę zaplanowanych wydarzeń, obsadzonych spotów oraz wolnych miejsc.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={config.dailyEvents.enabled}
                  onCheckedChange={(checked) =>
                    setConfig({
                      ...config,
                      dailyEvents: { ...config.dailyEvents, enabled: checked },
                    })
                  }
                />
                <span className="text-xs font-medium">
                  {config.dailyEvents.enabled ? "Włączone" : "Wyłączone"}
                </span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="daily-time" className="text-xs">
                  Godzina wysyłki (czas polski)
                </Label>
                <Input
                  id="daily-time"
                  type="time"
                  value={config.dailyEvents.time}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      dailyEvents: { ...config.dailyEvents, time: e.target.value },
                    })
                  }
                  disabled={!config.dailyEvents.enabled}
                  className="w-36 text-xs"
                />
                <span className="text-[11px] text-muted-foreground">
                  Domyślnie: 08:00 rano
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="daily-role" className="text-xs">
                  Wzmianka roli na Discordzie (opcjonalnie)
                </Label>
                <Input
                  id="daily-role"
                  placeholder="@everyone lub <@&ID_ROLI>"
                  value={config.dailyEvents.roleMention ?? ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      dailyEvents: { ...config.dailyEvents, roleMention: e.target.value },
                    })
                  }
                  disabled={!config.dailyEvents.enabled}
                  className="text-xs font-mono"
                />
                <span className="text-[11px] text-muted-foreground">
                  Zostaw puste, aby wysłać cichą wiadomość bez pingu.
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleTriggerDaily}
                disabled={dailyPending || !config.webhookUrl}
              >
                {dailyPending ? (
                  <Spinner className="mr-1.5 h-3.5 w-3.5" />
                ) : (
                  <Sparkles className="mr-1.5 h-3.5 w-3.5 text-amber-500" />
                )}
                Wyślij dzisiejszy spis na Discord teraz (Ręczny trigger)
              </Button>
            </div>
          </div>

          {/* Sekcja 2: Przypomnienia o składkach */}
          <div className="rounded-lg border p-4 flex flex-col gap-4 bg-background">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-amber-500" />
                <div>
                  <h4 className="font-semibold text-sm">2. Przypomnienie o zaległych składkach</h4>
                  <p className="text-xs text-muted-foreground">
                    Wysyła zestawienie dłużników z poprzedniego tygodnia i ostrzeżenie o zbliżającym się auto-locku.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={config.feeReminders.enabled}
                  onCheckedChange={(checked) =>
                    setConfig({
                      ...config,
                      feeReminders: { ...config.feeReminders, enabled: checked },
                    })
                  }
                />
                <span className="text-xs font-medium">
                  {config.feeReminders.enabled ? "Włączone" : "Wyłączone"}
                </span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fee-day" className="text-xs">
                  Dzień tygodnia
                </Label>
                <select
                  id="fee-day"
                  value={config.feeReminders.dayOfWeek}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      feeReminders: {
                        ...config.feeReminders,
                        dayOfWeek: Number(e.target.value),
                      },
                    })
                  }
                  disabled={!config.feeReminders.enabled}
                  className="rounded-md border bg-background px-3 py-1.5 text-xs"
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-muted-foreground">
                  Zalecany: Wtorek
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fee-time" className="text-xs">
                  Godzina wysyłki (czas polski)
                </Label>
                <Input
                  id="fee-time"
                  type="time"
                  value={config.feeReminders.time}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      feeReminders: { ...config.feeReminders, time: e.target.value },
                    })
                  }
                  disabled={!config.feeReminders.enabled}
                  className="w-36 text-xs"
                />
                <span className="text-[11px] text-muted-foreground">
                  Domyślnie: 18:00
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fee-role" className="text-xs">
                  Wzmianka roli (opcjonalnie)
                </Label>
                <Input
                  id="fee-role"
                  placeholder="@everyone lub <@&ID_ROLI>"
                  value={config.feeReminders.roleMention ?? ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      feeReminders: {
                        ...config.feeReminders,
                        roleMention: e.target.value,
                      },
                    })
                  }
                  disabled={!config.feeReminders.enabled}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleTriggerFees}
                disabled={feePending || !config.webhookUrl}
              >
                {feePending ? (
                  <Spinner className="mr-1.5 h-3.5 w-3.5" />
                ) : (
                  <Coins className="mr-1.5 h-3.5 w-3.5 text-amber-500" />
                )}
                Wyślij przypomnienie o składkach teraz (Ręczny trigger)
              </Button>
            </div>
          </div>

          {/* Sekcja 3: Alerty o wrogach w V3 (Radar) */}
          <div className="rounded-lg border p-4 flex flex-col gap-4 bg-background">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-500" />
                <div>
                  <h4 className="font-semibold text-sm">3. Alerty o wrogach w V3 (Radar na żywo)</h4>
                  <p className="text-xs text-muted-foreground">
                    Gdy członek gildii oznaczy wroga na Radarze V3, bot natychmiast wyśle czerwony alert na kanał Discord.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={config.enemyAlerts?.enabled ?? true}
                  onCheckedChange={(checked) =>
                    setConfig({
                      ...config,
                      enemyAlerts: {
                        ...(config.enemyAlerts || { roleMention: "" }),
                        enabled: checked,
                      },
                    })
                  }
                />
                <span className="text-xs font-medium">
                  {(config.enemyAlerts?.enabled ?? true) ? "Włączone" : "Wyłączone"}
                </span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="enemy-role" className="text-xs">
                  Wzmianka roli przy wrogu (opcjonalnie)
                </Label>
                <Input
                  id="enemy-role"
                  placeholder="@here, @everyone lub <@&ID_ROLI>"
                  value={config.enemyAlerts?.roleMention ?? ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      enemyAlerts: {
                        ...(config.enemyAlerts || { enabled: true }),
                        roleMention: e.target.value,
                      },
                    })
                  }
                  disabled={!(config.enemyAlerts?.enabled ?? true)}
                  className="text-xs font-mono"
                />
                <span className="text-[11px] text-muted-foreground">
                  Zalecany: @here lub konkretna rola PvP / V3, aby zaalarmować graczy.
                </span>
              </div>

              <div className="flex flex-col justify-between pt-1 sm:pt-0">
                <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg border">
                  ⚡ <strong>Działanie natychmiastowe:</strong> Powiadomienie wysyłane jest w ułamku sekundy po 1-kliku na radarze przez dowolnego członka gildii.
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleTriggerEnemyAlert}
                disabled={enemyPending || !config.webhookUrl}
              >
                {enemyPending ? (
                  <Spinner className="mr-1.5 h-3.5 w-3.5" />
                ) : (
                  <ShieldAlert className="mr-1.5 h-3.5 w-3.5 text-red-500" />
                )}
                Wyślij próbny alert o wrogu (Test na Discordzie)
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-muted-foreground/80" />
              Harmonogram automatyczny działa co godzinę w oparciu o Vercel Cron.
            </div>
            <Button type="submit" disabled={pending} className="font-semibold">
              {pending ? <Spinner className="mr-1.5 h-4 w-4" /> : <Check className="mr-1.5 h-4 w-4" />}
              Zapisz konfigurację Discorda
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
