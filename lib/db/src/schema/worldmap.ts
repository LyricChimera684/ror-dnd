import { pgTable, text, serial, integer, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { gameSessionsTable } from "./sessions";

export const worldMapsTable = pgTable("world_maps", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().unique().references(() => gameSessionsTable.id),
  locations: json("locations").notNull().default([]),
  currentLocation: text("current_location"),
  ascii: text("ascii"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertWorldMapSchema = createInsertSchema(worldMapsTable).omit({ id: true, updatedAt: true });
export type InsertWorldMap = z.infer<typeof insertWorldMapSchema>;
export type WorldMap = typeof worldMapsTable.$inferSelect;
