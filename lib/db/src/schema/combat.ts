import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { gameSessionsTable } from "./sessions";

export const combatStatesTable = pgTable("combat_states", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().unique().references(() => gameSessionsTable.id),
  active: boolean("active").notNull().default(false),
  round: integer("round").notNull().default(1),
  combatants: json("combatants").notNull().default([]),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCombatStateSchema = createInsertSchema(combatStatesTable).omit({ id: true, updatedAt: true });
export type InsertCombatState = z.infer<typeof insertCombatStateSchema>;
export type CombatState = typeof combatStatesTable.$inferSelect;
