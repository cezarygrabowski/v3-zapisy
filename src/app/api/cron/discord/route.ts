import { NextResponse } from "next/server"
import { todayInWarsaw, weekStartInWarsaw } from "@/lib/dates"
import { getDiscordConfig, saveDiscordConfig } from "@/lib/settings"
import {
  buildDailyEventsPayload,
  buildFeeReminderPayload,
  sendDiscordWebhook,
} from "@/lib/discord"

export const dynamic = "force-dynamic"

function getWarsawTimeInfo(now = new Date()): {
  today: string
  currentHourStr: string // "08"
  currentDayOfWeek: number // 1 (Mon) to 7 (Sun)
} {
  const today = todayInWarsaw(now)

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Warsaw",
    hour: "2-digit",
    weekday: "narrow",
    hourCycle: "h23",
  }).formatToParts(now)

  const hourPart = parts.find((p) => p.type === "hour")?.value ?? "00"

  // Day of week: Monday = 1, Sunday = 7
  // Create a UTC date representing the Warsaw day to get weekday
  const [y, m, d] = today.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const jsDay = dt.getUTCDay() // 0 = Sunday, 1 = Monday
  const currentDayOfWeek = jsDay === 0 ? 7 : jsDay

  return {
    today,
    currentHourStr: hourPart,
    currentDayOfWeek,
  }
}

export async function GET(request: Request) {
  // Optional Vercel Cron authorization check
  const authHeader = request.headers.get("authorization")
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const config = await getDiscordConfig()
  if (!config.webhookUrl) {
    return NextResponse.json({ ok: true, message: "Discord webhook not configured." })
  }

  const now = new Date()
  const { today, currentHourStr, currentDayOfWeek } = getWarsawTimeInfo(now)
  const currentWeekStart = weekStartInWarsaw(now)

  const executedActions: string[] = []
  let configChanged = false

  // 1. Daily Events Notification
  if (config.dailyEvents.enabled) {
    const [targetH] = config.dailyEvents.time.split(":")
    const shouldSendToday = config.dailyEvents.lastSentDate !== today
    const isTargetHour = targetH === currentHourStr

    if (shouldSendToday && isTargetHour) {
      try {
        const payload = await buildDailyEventsPayload(today, config.dailyEvents.roleMention)
        const sendRes = await sendDiscordWebhook(config.webhookUrl, payload)
        if (sendRes.ok) {
          config.dailyEvents.lastSentDate = today
          configChanged = true
          executedActions.push(`Daily events sent for ${today}`)
        } else {
          console.error("[cron/discord] Failed sending daily events:", sendRes.error)
        }
      } catch (err) {
        console.error("[cron/discord] Error in daily events cron:", err)
      }
    }
  }

  // 2. Fee Reminders Notification
  if (config.feeReminders.enabled) {
    const [targetH] = config.feeReminders.time.split(":")
    const isTargetDay = config.feeReminders.dayOfWeek === currentDayOfWeek
    // If running under a daily cron (or hour matches), trigger on the designated day
    const isTargetHour = targetH === currentHourStr || Boolean(process.env.VERCEL)
    const shouldSendThisWeek = config.feeReminders.lastSentWeek !== currentWeekStart

    if (isTargetDay && isTargetHour && shouldSendThisWeek) {
      try {
        const payload = await buildFeeReminderPayload(config.feeReminders.roleMention)
        const sendRes = await sendDiscordWebhook(config.webhookUrl, payload)
        if (sendRes.ok) {
          config.feeReminders.lastSentWeek = currentWeekStart
          configChanged = true
          executedActions.push(`Fee reminder sent for week ${currentWeekStart}`)
        } else {
          console.error("[cron/discord] Failed sending fee reminders:", sendRes.error)
        }
      } catch (err) {
        console.error("[cron/discord] Error in fee reminders cron:", err)
      }
    }
  }

  if (configChanged) {
    await saveDiscordConfig(config, "cron")
  }

  return NextResponse.json({
    ok: true,
    nowWarsaw: `${today} ${currentHourStr}:00`,
    executed: executedActions,
  })
}
