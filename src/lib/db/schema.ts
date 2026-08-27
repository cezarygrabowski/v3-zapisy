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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

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

export const usersRelations = relations(users, ({ many }) => ({
  signups: many(signups),
  reportedKills: many(runKills),
  feePayments: many(feePayments),
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

export type User = typeof users.$inferSelect
export type Signup = typeof signups.$inferSelect
export type FeePayment = typeof feePayments.$inferSelect
export type RunKill = typeof runKills.$inferSelect
