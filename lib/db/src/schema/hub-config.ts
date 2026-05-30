import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const hubConfigTable = pgTable("hub_config", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
