import test, { describe } from "node:test"
import assert from "node:assert/strict"
import { DEFAULT_DISCORD_CONFIG } from "@/lib/discord-types"
import {
  buildDailyEventsPayload,
  buildFeeReminderPayload,
  getAppBaseUrl,
  sendDiscordWebhook,
} from "@/lib/discord"

describe("Discord Webhook & Configuration Logic", () => {
  test("default configuration has expected defaults", () => {
    assert.equal(DEFAULT_DISCORD_CONFIG.webhookUrl, "")
    assert.equal(DEFAULT_DISCORD_CONFIG.dailyEvents.enabled, true)
    assert.equal(DEFAULT_DISCORD_CONFIG.dailyEvents.time, "08:00")
    assert.equal(DEFAULT_DISCORD_CONFIG.feeReminders.enabled, true)
    assert.equal(DEFAULT_DISCORD_CONFIG.feeReminders.dayOfWeek, 2)
    assert.equal(DEFAULT_DISCORD_CONFIG.feeReminders.time, "18:00")
  })

  test("rejects invalid webhook URLs", async () => {
    const invalidUrl = "https://example.com/not-a-webhook"
    const res = await sendDiscordWebhook(invalidUrl, { content: "Test" })
    assert.equal(res.ok, false)
    assert.match(res.error || "", /Nieprawidłowy adres Discord Webhook URL/)

    const emptyUrl = ""
    const resEmpty = await sendDiscordWebhook(emptyUrl, { content: "Test" })
    assert.equal(resEmpty.ok, false)
  })

  test("generates valid daily events payload structure", async () => {
    const payload = await buildDailyEventsPayload("2026-09-12", "@here")
    assert.ok(payload.embeds)
    assert.ok(payload.embeds.length > 0)
    assert.ok(payload.content?.includes("@here"))

    const firstEmbed = payload.embeds[0]
    assert.ok(firstEmbed.title)
    assert.ok(firstEmbed.footer?.text.includes("ElderHub"))
  })

  test("generates valid fee reminder payload structure", async () => {
    const payload = await buildFeeReminderPayload("<@&123456789>")
    assert.ok(payload.embeds)
    assert.ok(payload.embeds.length > 0)
    assert.ok(payload.content?.includes("<@&123456789>"))

    const firstEmbed = payload.embeds[0]
    assert.ok(firstEmbed.title?.toLowerCase().includes("składki"))
  })

  test("resolves correct app base URL", () => {
    const baseUrl = getAppBaseUrl()
    assert.ok(baseUrl.startsWith("http"))
    assert.equal(baseUrl.endsWith("/"), false)
  })
})
