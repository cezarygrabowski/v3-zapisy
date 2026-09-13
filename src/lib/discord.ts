import { formatDatePl, todayInWarsaw } from "@/lib/dates"
import { getGuildEventDetails, listGuildEvents } from "@/lib/calendar-queries"
import { getFeeLedger } from "@/lib/queries"
import { getFeeSettlementDays } from "@/lib/settings"
import { weekStartInWarsaw, addDays } from "@/lib/dates"

export type DiscordEmbed = {
  title?: string
  description?: string
  url?: string
  color?: number // decimal integer, e.g. 0x3b82f6
  fields?: { name: string; value: string; inline?: boolean }[]
  footer?: { text: string; icon_url?: string }
  timestamp?: string
}

export type DiscordWebhookPayload = {
  content?: string
  username?: string
  avatar_url?: string
  embeds?: DiscordEmbed[]
}

const DEFAULT_BOT_NAME = "ElderHub Bot"
const DEFAULT_AVATAR_URL = "https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/swords.png"

export function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "")
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`.replace(/\/$/, "")
  }
  return "https://elder-hub.vercel.app"
}

/**
 * Sends a payload to a Discord Webhook endpoint.
 */
export async function sendDiscordWebhook(
  webhookUrl: string,
  payload: DiscordWebhookPayload
): Promise<{ ok: boolean; error?: string }> {
  if (!webhookUrl || !webhookUrl.trim().startsWith("https://discord.com/api/webhooks/")) {
    return { ok: false, error: "Nieprawidłowy adres Discord Webhook URL." }
  }

  try {
    const res = await fetch(webhookUrl.trim(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: payload.username ?? DEFAULT_BOT_NAME,
        avatar_url: payload.avatar_url ?? DEFAULT_AVATAR_URL,
        ...payload,
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      console.error("[discord] Webhook failed:", res.status, text)
      return {
        ok: false,
        error: `Discord zwrócił błąd HTTP ${res.status}: ${text.slice(0, 150)}`,
      }
    }

    return { ok: true }
  } catch (err) {
    console.error("[discord] Network error sending webhook:", err)
    return { ok: false, error: (err as Error)?.message || "Błąd sieci podczas wysyłki do Discord." }
  }
}

/**
 * Builds the daily events summary payload for a given date.
 */
export async function buildDailyEventsPayload(
  targetDate?: string,
  roleMention?: string
): Promise<DiscordWebhookPayload> {
  const date = targetDate ?? todayInWarsaw(new Date())
  const datePl = formatDatePl(date)
  const baseUrl = getAppBaseUrl()

  const events = await listGuildEvents({
    startDate: date,
    endDate: date,
    limit: 20,
  })

  const mention = roleMention?.trim() ? `${roleMention.trim()} ` : ""

  if (events.length === 0) {
    return {
      content: mention || undefined,
      embeds: [
        {
          title: `📅 Wydarzenia gildyjne — ${datePl}`,
          description: "Na dzisiejszy dzień nie ma jeszcze zaplanowanych żadnych wydarzeń w kalendarzu.\n\nMożesz zaplanować wyprawę na stronie.",
          url: `${baseUrl}/kalendarz`,
          color: 0x64748b, // slate
          footer: { text: "ElderHub • Kalendarz Gildii" },
          timestamp: new Date().toISOString(),
        },
      ],
    }
  }

  const embeds: DiscordEmbed[] = []

  for (const item of events) {
    const details = await getGuildEventDetails(item.id)
    const eventUrl = `${baseUrl}/kalendarz/wydarzenie/${item.id}`
    const timeLabel = item.endTime ? `${item.startTime} – ${item.endTime}` : `od ${item.startTime}`

    // Colors according to type
    let color = 0x3b82f6 // blue
    if (item.type === "v3") color = 0xf59e0b // amber
    if (item.type === "red_las") color = 0xef4444 // red
    if (item.type === "dungeon") color = 0x8b5cf6 // purple

    const fields: { name: string; value: string; inline?: boolean }[] = [
      {
        name: "⏰ Czas trwania",
        value: `${timeLabel} (${item.durationHours}h)`,
        inline: true,
      },
    ]

    if (details) {
      if (details.signupMode === "spots") {
        // Collect spots breakdown
        const signedSpots = (details.signups || []).filter((e) => Boolean(e.spot))
        if (signedSpots.length > 0) {
          const listStr = signedSpots
            .map((s) => `• **${s.spot}**: ${s.gameNick}${s.role ? ` *(${s.role})*` : ""}`)
            .join("\n")

          fields.push({
            name: item.type === "v3" ? `👥 Obsadzone miejsca (${signedSpots.length}/7)` : `👥 Obsadzone miejsca (${signedSpots.length})`,
            value: listStr.length > 1024 ? `${listStr.slice(0, 1000)}...` : listStr,
            inline: false,
          })
        }

        // V3 standard spots check for empty spots
        if (item.type === "v3") {
          const STANDARD_V3_SPOTS = ["R1", "R2", "R3", "R4", "PRAWO", "LEWO", "POLKA"]
          const takenSpots = new Set(signedSpots.map((s) => s.spot?.toUpperCase()))
          const freeSpots = STANDARD_V3_SPOTS.filter((spot) => !takenSpots.has(spot))

          if (freeSpots.length > 0) {
            fields.push({
              name: `🟢 Wolne miejsca (${freeSpots.length})`,
              value: freeSpots.map((s) => `\`${s}\``).join(", "),
              inline: false,
            })
          } else {
            fields.push({
              name: "🔒 Status miejsc",
              value: "✅ Wszystkie główne spoty obsadzone!",
              inline: false,
            })
          }
        }
      } else {
        // Party or free mode
        const total = details.signups?.length ?? details.allParticipants.length
        const max = details.maxParticipants ? ` / ${details.maxParticipants}` : ""
        fields.push({
          name: `👥 Zapisane postacie (${total}${max})`,
          value:
            details.signups && details.signups.length > 0
              ? details.signups.map((s) => `• ${s.characterName || s.gameNick}${s.role ? ` *(${s.role})*` : ""}`).join("\n").slice(0, 1000)
              : "*Brak zapisanych postaci — bądź pierwszy!*",
          inline: false,
        })
      }
    }

    fields.push({
      name: "🔗 Zapisz się na stronie",
      value: `[Kliknij tutaj, aby przejść do wydarzenia](${eventUrl})`,
      inline: false,
    })

    const typeEmoji = item.type === "v3" ? "⚔️" : item.type === "red_las" ? "🌲" : item.type === "dungeon" ? "🏰" : "🛡️"

    embeds.push({
      title: `${typeEmoji} ${item.title}`,
      description: item.description || undefined,
      url: eventUrl,
      color,
      fields,
      footer: { text: `ElderHub • ${item.type.toUpperCase()}` },
      timestamp: new Date().toISOString(),
    })
  }

  return {
    content: mention ? `${mention}**Plan wydarzeń na dzisiaj (${datePl}):**` : `**Plan wydarzeń na dzisiaj (${datePl}):**`,
    embeds,
  }
}

/**
 * Builds the fee reminder payload for users with overdue fees.
 */
export async function buildFeeReminderPayload(
  roleMention?: string
): Promise<DiscordWebhookPayload> {
  const baseUrl = getAppBaseUrl()
  const ledger = await getFeeLedger()
  const settlementDays = await getFeeSettlementDays()

  const now = new Date()
  const currentWeekStart = weekStartInWarsaw(now)
  const previousWeekStart = addDays(currentWeekStart, -7)

  // Find users with unpaid fees for the previous week
  const debtors: {
    userId: string
    gameNick: string
    unpaidPrevWeekKk: number
    totalOverdueKk: number
  }[] = []

  for (const [userId, state] of ledger.entries()) {
    const prevWeek = state.overdueWeeks.find((w) => w.weekStart === previousWeekStart)
    const unpaidPrev = prevWeek ? prevWeek.remainingKk : 0
    if (unpaidPrev > 0 || state.overdueKk > 0) {
      debtors.push({
        userId,
        gameNick: state.gameNick,
        unpaidPrevWeekKk: unpaidPrev,
        totalOverdueKk: state.overdueKk,
      })
    }
  }

  debtors.sort((a, b) => b.totalOverdueKk - a.totalOverdueKk)

  const mention = roleMention?.trim() ? `${roleMention.trim()} ` : ""

  if (debtors.length === 0) {
    return {
      content: mention || undefined,
      embeds: [
        {
          title: "💰 Składki gildyjne — Wszystko opłacone!",
          description: "Wszyscy członkowie gildii mają uregulowane składki za poprzedni tydzień. Dobra robota! 🎉",
          url: `${baseUrl}/skladki`,
          color: 0x22c55e, // green
          footer: { text: "ElderHub • Rozliczenia" },
          timestamp: new Date().toISOString(),
        },
      ],
    }
  }

  const totalDebtKk = debtors.reduce((acc, d) => acc + d.totalOverdueKk, 0)
  const listFormatted = debtors
    .slice(0, 25)
    .map((d) => `• **${d.gameNick}**: \`${d.totalOverdueKk} kk\`${d.unpaidPrevWeekKk > 0 ? ` *(w tym ${d.unpaidPrevWeekKk} kk za poprzedni tydzień)*` : ""}`)
    .join("\n")

  return {
    content: mention ? `${mention}⚠️ **Przypomnienie o składkach gildyjnych:**` : "⚠️ **Przypomnienie o składkach gildyjnych:**",
    embeds: [
      {
        title: "💰 Nierozliczone składki za poprzedni tydzień",
        description: `Przypominamy o obowiązku uregulowania składek za wyprawy V3. Na opłacenie zaległości jest pierwsze **${settlementDays} dni** nowego tygodnia. Po tym terminie następuje **automatyczna blokada zapisów na kolejne V3**!`,
        url: `${baseUrl}/skladki`,
        color: 0xef4444, // red
        fields: [
          {
            name: `📋 Gracze z zaległościami (${debtors.length}) — Łącznie: ${totalDebtKk} kk`,
            value: listFormatted.length > 1024 ? `${listFormatted.slice(0, 1000)}...` : listFormatted,
            inline: false,
          },
          {
            name: "💳 Jak opłacić?",
            value: `Przekaż yangi w grze jednemu z liderów, a następnie zgłoś wpłatę na stronie w zakładce [Składki](${baseUrl}/skladki).`,
            inline: false,
          },
        ],
        footer: { text: "ElderHub • Składki i Finanse" },
        timestamp: new Date().toISOString(),
      },
    ],
  }
}

/**
 * Builds an enemy spotted alert payload for Discord.
 */
export function buildEnemyAlertPayload(params: {
  enemyName: string
  guild?: string | null
  spotterNick: string
  roleMention?: string
}): DiscordWebhookPayload {
  const baseUrl = getAppBaseUrl()
  const mention = params.roleMention?.trim() ? `${params.roleMention.trim()} ` : ""
  const guildInfo = params.guild ? `[${params.guild}] ` : ""

  return {
    content: mention ? `${mention}🚨 **WRÓG W LOCHU PAJĄKÓW V3!**` : "🚨 **WRÓG W LOCHU PAJĄKÓW V3!**",
    embeds: [
      {
        title: `⚔️ Wykryto wroga: ${guildInfo}${params.enemyName}`,
        description: `Gracz **${params.spotterNick}** właśnie zauważył wroga w komnacie V3!\n\nSprawdź [Radar Wrogów na Panelu V3](${baseUrl}/panel), aby monitorować sytuację.`,
        url: `${baseUrl}/panel`,
        color: 0xdc2626, // bright red
        fields: [
          {
            name: "👤 Wróg",
            value: `**${params.enemyName}**`,
            inline: true,
          },
          {
            name: "🛡️ Gildia",
            value: params.guild ? `**${params.guild}**` : "—",
            inline: true,
          },
          {
            name: "👀 Zgłoszony przez",
            value: params.spotterNick,
            inline: true,
          },
        ],
        footer: { text: "ElderHub • Radar Wrogów V3" },
        timestamp: new Date().toISOString(),
      },
    ],
  }
}

/**
 * Sends a background Discord notification when an enemy enters V3.
 * Throttles/fails gracefully without throwing errors or blocking the caller.
 */
export async function notifyV3EnemySpotted(params: {
  enemyName: string
  guild?: string | null
  spotterNick: string
}): Promise<void> {
  try {
    const { getDiscordConfig } = await import("@/lib/settings")
    const config = await getDiscordConfig()

    if (!config.webhookUrl || !config.enemyAlerts?.enabled) {
      return
    }

    const payload = buildEnemyAlertPayload({
      ...params,
      roleMention: config.enemyAlerts.roleMention,
    })

    await sendDiscordWebhook(config.webhookUrl, payload)
  } catch (err) {
    console.error("[discord] Error sending enemy spotted alert:", err)
  }
}

