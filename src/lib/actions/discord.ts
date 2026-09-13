"use server"

import { revalidatePath } from "next/cache"
import { requireLeader } from "@/lib/session"
import { fail, ok, type ActionResult } from "@/lib/actions/result"
import {
  getDiscordConfig,
  saveDiscordConfig,
  type DiscordConfig,
} from "@/lib/settings"
import {
  buildDailyEventsPayload,
  buildFeeReminderPayload,
  sendDiscordWebhook,
} from "@/lib/discord"

/**
 * Saves Discord notification settings.
 */
export async function updateDiscordSettings(
  input: DiscordConfig
): Promise<ActionResult> {
  const leader = await requireLeader()

  if (input.webhookUrl && !input.webhookUrl.trim().startsWith("https://discord.com/api/webhooks/")) {
    return fail("Adres webhooka musi zaczynać się od https://discord.com/api/webhooks/")
  }

  // Validate times
  if (!/^\d{2}:\d{2}$/.test(input.dailyEvents.time)) {
    return fail("Nieprawidłowy format godziny dla codziennego spisu (oczekiwano HH:MM).")
  }
  if (!/^\d{2}:\d{2}$/.test(input.feeReminders.time)) {
    return fail("Nieprawidłowy format godziny dla przypomnienia o składkach (oczekiwano HH:MM).")
  }

  await saveDiscordConfig(input, leader.id)
  revalidatePath("/admin/konfiguracja")
  return ok("Zapisano ustawienia powiadomień Discord.")
}

/**
 * Sends a quick test notification to verify that the webhook is valid and functional.
 */
export async function testDiscordWebhook(
  webhookUrl: string
): Promise<ActionResult> {
  await requireLeader()

  if (!webhookUrl || !webhookUrl.trim().startsWith("https://discord.com/api/webhooks/")) {
    return fail("Wprowadź prawidłowy Discord Webhook URL.")
  }

  const result = await sendDiscordWebhook(webhookUrl, {
    embeds: [
      {
        title: "🔔 Test połączenia z Discordem",
        description: "Połączenie między aplikacją **ElderHub** a tym kanałem działa prawidłowo! 🎉\n\nPowiadomienia o wydarzeniach i składkach będą pojawiać się tutaj.",
        color: 0x22c55e, // green
        footer: { text: "ElderHub • Test Webhooka" },
        timestamp: new Date().toISOString(),
      },
    ],
  })

  if (!result.ok) {
    return fail(result.error ?? "Nie udało się wysłać wiadomości testowej.")
  }

  return ok("Wysłano wiadomość testową na kanał Discord!")
}

/**
 * Manually triggers the Daily Events summary on Discord right now.
 */
export async function triggerDailyEventsNotificationNow(): Promise<ActionResult> {
  await requireLeader()

  const config = await getDiscordConfig()
  if (!config.webhookUrl) {
    return fail("Najpierw skonfiguruj i zapisz adres Discord Webhook URL.")
  }

  const payload = await buildDailyEventsPayload(undefined, config.dailyEvents.roleMention)
  const result = await sendDiscordWebhook(config.webhookUrl, payload)

  if (!result.ok) {
    return fail(result.error ?? "Błąd podczas wysyłania spisu na Discord.")
  }

  return ok("Pomyślnie wysłano dzisiejszy spis wydarzeń na Discord!")
}

/**
 * Manually triggers the Fee Reminder notification on Discord right now.
 */
export async function triggerFeeReminderNotificationNow(): Promise<ActionResult> {
  await requireLeader()

  const config = await getDiscordConfig()
  if (!config.webhookUrl) {
    return fail("Najpierw skonfiguruj i zapisz adres Discord Webhook URL.")
  }

  const payload = await buildFeeReminderPayload(config.feeReminders.roleMention)
  const result = await sendDiscordWebhook(config.webhookUrl, payload)

  if (!result.ok) {
    return fail(result.error ?? "Błąd podczas wysyłania przypomnienia na Discord.")
  }

  return ok("Pomyślnie wysłano przypomnienie o składkach na Discord!")
}

/**
 * Manually triggers a test Enemy Alert notification on Discord right now.
 */
export async function triggerEnemyAlertNotificationNow(): Promise<ActionResult> {
  const leader = await requireLeader()

  const config = await getDiscordConfig()
  if (!config.webhookUrl) {
    return fail("Najpierw skonfiguruj i zapisz adres Discord Webhook URL.")
  }

  const { buildEnemyAlertPayload } = await import("@/lib/discord")
  const payload = buildEnemyAlertPayload({
    enemyName: "TestowyWróg (Test)",
    guild: "WrogowieGildii",
    characterClass: "Wojownik",
    spotterNick: leader.gameNick,
    roleMention: config.enemyAlerts.roleMention,
  })

  const result = await sendDiscordWebhook(config.webhookUrl, payload)

  if (!result.ok) {
    return fail(result.error ?? "Błąd podczas wysyłania alertu na Discord.")
  }

  return ok("Pomyślnie wysłano próbny alert o wrogu na Discord!")
}

