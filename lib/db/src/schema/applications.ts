import {
  pgTable,
  text,
  uuid,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const applicationStatusEnum = pgEnum("application_status", [
  "pending",
  "routed",
  "shortlisted",
  "accepted",
  "declined",
  "archived",
]);

export const applicationsTable = pgTable("applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  status: applicationStatusEnum("status").notNull().default("pending"),
  companyName: text("company_name").notNull(),
  website: text("website"),
  stage: text("stage"),
  teamSize: text("team_size"),
  transcript: jsonb("transcript").notNull().default([]),
  structuredData: jsonb("structured_data"),
  departmentScores: jsonb("department_scores"),
  businessCases: jsonb("business_cases"),
  trackingToken: text("tracking_token").notNull().unique().default(sql`gen_random_uuid()::text`),
  notes: text("notes"),
});

export const insertApplicationSchema = createInsertSchema(applicationsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type Application = typeof applicationsTable.$inferSelect;
