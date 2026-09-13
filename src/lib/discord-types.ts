export type DiscordDailyEventsConfig = {
  enabled: boolean
  time: string // format "HH:MM", default "08:00"
  roleMention?: string // e.g. "@everyone", "@here", or "<@&123456789>"
  lastSentDate?: string // ISO date "YYYY-MM-DD" in Warsaw time
}

export type DiscordFeeRemindersConfig = {
  enabled: boolean
  dayOfWeek: number // 1 = Monday, 2 = Tuesday, ..., 7 = Sunday. Default: 2 (Tuesday)
  time: string // format "HH:MM", default "18:00"
  roleMention?: string
  lastSentWeek?: string // ISO week start "YYYY-MM-DD"
}

export type DiscordConfig = {
  webhookUrl: string
  dailyEvents: DiscordDailyEventsConfig
  feeReminders: DiscordFeeRemindersConfig
}

export const SETTING_KEY_DISCORD_CONFIG = "discord_config"

export const DEFAULT_DISCORD_CONFIG: DiscordConfig = {
  webhookUrl: "",
  dailyEvents: {
    enabled: true,
    time: "08:00",
    roleMention: "",
  },
  feeReminders: {
    enabled: true,
    dayOfWeek: 2, // Tuesday (before auto-lock deadline)
    time: "18:00",
    roleMention: "",
  },
}
