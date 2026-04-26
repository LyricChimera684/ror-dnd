import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { gameSessionsTable } from "./sessions";

export const npcsTable = pgTable("npcs", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => gameSessionsTable.id),
  name: text("name").notNull(),
  description: text("description").notNull(),
  disposition: text("disposition").notNull().default("neutral"),
  firstMet: text("first_met"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNpcSchema = createInsertSchema(npcsTable).omit({ id: true, createdAt: true });
export type InsertNpc = z.infer<typeof insertNpcSchema>;
export type Npc = typeof npcsTable.$inferSelect;
