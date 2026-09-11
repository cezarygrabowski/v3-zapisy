import { relations } from "drizzle-orm"
import { boolean, integer, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core"

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  discordId: text("discord_id").unique(),
  discordName: text("discord_name").notNull(),
  gameNick: text("game_nick").notNull(),
  login: text("login").unique(),
  passwordHash: text("password_hash"),
  playstyle: text("playstyle"),
  isLeader: boolean("is_leader").notNull().default(false),
  isVerified: boolean("is_verified").notNull().default(false),
  roles: text("roles").notNull().default("[]"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const userCharacters = pgTable("user_characters", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull().unique(),
  playstyle: text("playstyle").notNull().default("pvm"),
  isMain: boolean("is_main").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export { ROLE_V3, PREDEFINED_ROLES, type PredefinedRole } from "@/lib/constants"

export const signups = pgTable(
  "signups",
  {
    id: text("id").primaryKey(),
    date: text("date").notNull(),
    slot: text("slot").notNull(),
    position: text("position").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    feeKk: integer("fee_kk").notNull(),
    paid: boolean("paid").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("signups_slot_unique").on(table.date, table.slot, table.position),
    unique("signups_user_day_unique").on(table.date, table.userId),
  ]
)

export const runKills = pgTable("run_kills", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  reportedBy: text("reported_by")
    .notNull()
    .references(() => users.id),
  killedAt: timestamp("killed_at", { withTimezone: true }).notNull().defaultNow(),
  killedAtLabel: text("killed_at_label").notNull(),
  date: text("date").notNull(),
  slot: text("slot"),
})

export const feePayments = pgTable("fee_payments", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  amountKk: integer("amount_kk").notNull(),
  status: text("status").notNull(),
  reportedBy: text("reported_by")
    .notNull()
    .references(() => users.id),
  confirmedBy: text("confirmed_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
})

export const runSyncs = pgTable("run_syncs", {
  kind: text("kind").primaryKey(),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull(),
  syncedAtLabel: text("synced_at_label").notNull(),
  updatedBy: text("updated_by")
    .notNull()
    .references(() => users.id),
})

export const runKillHelpers = pgTable(
  "run_kill_helpers",
  {
    killId: text("kill_id")
      .notNull()
      .references(() => runKills.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
  },
  (table) => [unique("run_kill_helpers_unique").on(table.killId, table.userId)]
)

export const redExpeditions = pgTable("red_expeditions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  spot: text("spot").notNull().default("boss"),
  date: text("date").notNull(),
  startTime: text("start_time").notNull(),
  durationHours: integer("duration_hours").notNull().default(3),
  respawnMinutes: integer("respawn_minutes").notNull().default(50),
  respawnMinMinutes: integer("respawn_min_minutes").notNull().default(48),
  respawnMaxMinutes: integer("respawn_max_minutes").notNull().default(52),
  status: text("status").notNull().default("planned"),
  notes: text("notes"),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const redExpeditionSignups = pgTable(
  "red_expedition_signups",
  {
    id: text("id").primaryKey(),
    expeditionId: text("expedition_id")
      .notNull()
      .references(() => redExpeditions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    hourIndex: integer("hour_index").notNull(),
    attended: boolean("attended").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("red_expedition_signups_unique").on(table.expeditionId, table.userId, table.hourIndex),
  ]
)

export const redBossKills = pgTable("red_boss_kills", {
  id: text("id").primaryKey(),
  expeditionId: text("expedition_id").references(() => redExpeditions.id, { onDelete: "set null" }),
  channel: integer("channel").notNull(),
  reportedBy: text("reported_by")
    .notNull()
    .references(() => users.id),
  killedAt: timestamp("killed_at", { withTimezone: true }).notNull().defaultNow(),
  killedAtLabel: text("killed_at_label").notNull(),
  date: text("date").notNull(),
})

export const redShopItems = pgTable("red_shop_items", {
  id: text("id").primaryKey(),
  weekStart: text("week_start").notNull(),
  expeditionId: text("expedition_id").references(() => redExpeditions.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  quantity: integer("quantity").notNull().default(1),
  priceWon: integer("price_won").notNull().default(0),
  priceKk: integer("price_kk").notNull().default(0),
  status: text("status").notNull().default("listed"),
  soldPriceWon: integer("sold_price_won"),
  soldPriceKk: integer("sold_price_kk"),
  addedBy: text("added_by")
    .notNull()
    .references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  soldAt: timestamp("sold_at", { withTimezone: true }),
})

export const redPayouts = pgTable(
  "red_payouts",
  {
    id: text("id").primaryKey(),
    weekStart: text("week_start").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    isPaid: boolean("is_paid").notNull().default(false),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paidBy: text("paid_by").references(() => users.id),
  },
  (table) => [unique("red_payouts_week_user_unique").on(table.weekStart, table.userId)]
)

export const usersRelations = relations(users, ({ many }) => ({
  signups: many(signups),
  reportedKills: many(runKills),
  feePayments: many(feePayments),
  redExpeditions: many(redExpeditions),
  redExpeditionSignups: many(redExpeditionSignups),
  redBossKills: many(redBossKills),
  redShopItems: many(redShopItems),
  redPayouts: many(redPayouts),
}))

export const redExpeditionsRelations = relations(redExpeditions, ({ one, many }) => ({
  creator: one(users, {
    fields: [redExpeditions.createdBy],
    references: [users.id],
  }),
  signups: many(redExpeditionSignups),
  kills: many(redBossKills),
  items: many(redShopItems),
}))

export const redExpeditionSignupsRelations = relations(redExpeditionSignups, ({ one }) => ({
  expedition: one(redExpeditions, {
    fields: [redExpeditionSignups.expeditionId],
    references: [redExpeditions.id],
  }),
  user: one(users, {
    fields: [redExpeditionSignups.userId],
    references: [users.id],
  }),
}))

export const redBossKillsRelations = relations(redBossKills, ({ one }) => ({
  expedition: one(redExpeditions, {
    fields: [redBossKills.expeditionId],
    references: [redExpeditions.id],
  }),
  reporter: one(users, {
    fields: [redBossKills.reportedBy],
    references: [users.id],
  }),
}))

export const redShopItemsRelations = relations(redShopItems, ({ one }) => ({
  expedition: one(redExpeditions, {
    fields: [redShopItems.expeditionId],
    references: [redExpeditions.id],
  }),
  creator: one(users, {
    fields: [redShopItems.addedBy],
    references: [users.id],
  }),
}))

export const redPayoutsRelations = relations(redPayouts, ({ one }) => ({
  user: one(users, {
    fields: [redPayouts.userId],
    references: [users.id],
  }),
  payer: one(users, {
    fields: [redPayouts.paidBy],
    references: [users.id],
  }),
}))

export const feePaymentsRelations = relations(feePayments, ({ one }) => ({
  user: one(users, {
    fields: [feePayments.userId],
    references: [users.id],
  }),
}))

export const signupsRelations = relations(signups, ({ one }) => ({
  user: one(users, {
    fields: [signups.userId],
    references: [users.id],
  }),
}))

export const runKillsRelations = relations(runKills, ({ one, many }) => ({
  reporter: one(users, {
    fields: [runKills.reportedBy],
    references: [users.id],
  }),
  helpers: many(runKillHelpers),
}))

export const runKillHelpersRelations = relations(runKillHelpers, ({ one }) => ({
  kill: one(runKills, {
    fields: [runKillHelpers.killId],
    references: [runKills.id],
  }),
  user: one(users, {
    fields: [runKillHelpers.userId],
    references: [users.id],
  }),
}))

// --- CENTRAL TIMERS SYSTEM ---
export const timerCategories = pgTable("timer_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").notNull().default("🗺️"),
  orderIndex: integer("order_index").notNull().default(0),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const customTimers = pgTable("custom_timers", {
  id: text("id").primaryKey(),
  categoryId: text("category_id")
    .notNull()
    .references(() => timerCategories.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  channelsCount: integer("channels_count").notNull().default(5),
  respawnMinMinutes: integer("respawn_min_minutes").notNull().default(48),
  respawnMaxMinutes: integer("respawn_max_minutes").notNull().default(52),
  notes: text("notes"),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const customTimerKills = pgTable("custom_timer_kills", {
  id: text("id").primaryKey(),
  timerId: text("timer_id")
    .notNull()
    .references(() => customTimers.id, { onDelete: "cascade" }),
  channel: integer("channel").notNull(),
  killedAt: timestamp("killed_at", { withTimezone: true }).notNull().defaultNow(),
  killedAtLabel: text("killed_at_label").notNull(),
  reportedBy: text("reported_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

// --- GUILD EVENTS & CALENDAR ---
export const guildEvents = pgTable("guild_events", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type").notNull().default("v3"), // 'v3' | 'red_las' | 'dungeon' | 'boss' | 'war' | 'other'
  date: text("date").notNull(), // YYYY-MM-DD
  startTime: text("start_time").notNull(), // HH:MM
  endTime: text("end_time"), // HH:MM
  durationHours: integer("duration_hours").notNull().default(3),
  signupMode: text("signup_mode").notNull().default("spots"), // 'spots' | 'hourly' | 'party'
  recurrence: text("recurrence").notNull().default("none"), // 'none' | 'daily' | 'weekly' | 'weekdays'
  color: text("color").notNull().default("blue"), // Google Calendar color preset ID
  maxParticipants: integer("max_participants"),
  description: text("description"),
  status: text("status").notNull().default("planned"), // 'planned' | 'active' | 'finished' | 'cancelled'
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const guildEventSignups = pgTable(
  "guild_event_signups",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => guildEvents.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    characterId: text("character_id")
      .references(() => userCharacters.id, { onDelete: "set null" }),
    characterName: text("character_name"),
    hourIndex: integer("hour_index").notNull().default(0),
    spot: text("spot"), // e.g. "R1", "R2", "PRAWO", "polka", "boss"
    role: text("role"), // e.g. "pvp", "pvm", "Ninja Dagger"
    attended: boolean("attended").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  }
)

export const userCharactersRelations = relations(userCharacters, ({ one, many }) => ({
  user: one(users, {
    fields: [userCharacters.userId],
    references: [users.id],
  }),
  signups: many(guildEventSignups),
}))

export const timerCategoriesRelations = relations(timerCategories, ({ one, many }) => ({
  creator: one(users, {
    fields: [timerCategories.createdBy],
    references: [users.id],
  }),
  timers: many(customTimers),
}))

export const customTimersRelations = relations(customTimers, ({ one, many }) => ({
  category: one(timerCategories, {
    fields: [customTimers.categoryId],
    references: [timerCategories.id],
  }),
  creator: one(users, {
    fields: [customTimers.createdBy],
    references: [users.id],
  }),
  kills: many(customTimerKills),
}))

export const customTimerKillsRelations = relations(customTimerKills, ({ one }) => ({
  timer: one(customTimers, {
    fields: [customTimerKills.timerId],
    references: [customTimers.id],
  }),
  reporter: one(users, {
    fields: [customTimerKills.reportedBy],
    references: [users.id],
  }),
}))

export const guildEventsRelations = relations(guildEvents, ({ one, many }) => ({
  creator: one(users, {
    fields: [guildEvents.createdBy],
    references: [users.id],
  }),
  signups: many(guildEventSignups),
  auditLogs: many(guildEventAuditLogs),
}))

export const guildEventSignupsRelations = relations(guildEventSignups, ({ one }) => ({
  event: one(guildEvents, {
    fields: [guildEventSignups.eventId],
    references: [guildEvents.id],
  }),
  user: one(users, {
    fields: [guildEventSignups.userId],
    references: [users.id],
  }),
  character: one(userCharacters, {
    fields: [guildEventSignups.characterId],
    references: [userCharacters.id],
  }),
}))

export const guildEventAuditLogs = pgTable("guild_event_audit_logs", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => guildEvents.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // 'signup' | 'withdraw' | 'admin_withdraw' | 'admin_assign' | 'reschedule' | 'edit'
  actorId: text("actor_id")
    .notNull()
    .references(() => users.id),
  targetUserId: text("target_user_id").references(() => users.id),
  spot: text("spot"),
  role: text("role"),
  reason: text("reason"),
  details: text("details"), // JSON with additional metadata
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const guildEventAuditLogsRelations = relations(guildEventAuditLogs, ({ one }) => ({
  event: one(guildEvents, {
    fields: [guildEventAuditLogs.eventId],
    references: [guildEvents.id],
  }),
  actor: one(users, {
    fields: [guildEventAuditLogs.actorId],
    references: [users.id],
  }),
  targetUser: one(users, {
    fields: [guildEventAuditLogs.targetUserId],
    references: [users.id],
  }),
}))

export const guildSettings = pgTable("guild_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by").references(() => users.id),
})

export const guildSettingsRelations = relations(guildSettings, ({ one }) => ({
  updater: one(users, {
    fields: [guildSettings.updatedBy],
    references: [users.id],
  }),
}))

export const userPenalties = pgTable("user_penalties", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  adminId: text("admin_id")
    .notNull()
    .references(() => users.id),
  eventId: text("event_id")
    .references(() => guildEvents.id, { onDelete: "set null" }),
  reason: text("reason").notNull(),
  cardLevel: integer("card_level").notNull().default(1), // 1: 3d, 2: 7d, 3: 14d
  durationDays: integer("duration_days").notNull(), // 3, 7, 14
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedBy: text("revoked_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const userPenaltiesRelations = relations(userPenalties, ({ one }) => ({
  user: one(users, {
    fields: [userPenalties.userId],
    references: [users.id],
  }),
  admin: one(users, {
    fields: [userPenalties.adminId],
    references: [users.id],
  }),
  event: one(guildEvents, {
    fields: [userPenalties.eventId],
    references: [guildEvents.id],
  }),
  revoker: one(users, {
    fields: [userPenalties.revokedBy],
    references: [users.id],
  }),
}))

export type User = typeof users.$inferSelect
export type Signup = typeof signups.$inferSelect
export type FeePayment = typeof feePayments.$inferSelect
export type RunKill = typeof runKills.$inferSelect
export type RedExpedition = typeof redExpeditions.$inferSelect
export type RedExpeditionSignup = typeof redExpeditionSignups.$inferSelect
export type RedBossKill = typeof redBossKills.$inferSelect
export type RedShopItem = typeof redShopItems.$inferSelect
export type RedPayout = typeof redPayouts.$inferSelect
export type TimerCategory = typeof timerCategories.$inferSelect
export type CustomTimer = typeof customTimers.$inferSelect
export type CustomTimerKill = typeof customTimerKills.$inferSelect
export type GuildEvent = typeof guildEvents.$inferSelect
export type GuildEventSignup = typeof guildEventSignups.$inferSelect
export type GuildEventAuditLog = typeof guildEventAuditLogs.$inferSelect
export type GuildSetting = typeof guildSettings.$inferSelect
export type UserPenalty = typeof userPenalties.$inferSelect
export type UserCharacter = typeof userCharacters.$inferSelect
export type NewUserCharacter = typeof userCharacters.$inferInsert
