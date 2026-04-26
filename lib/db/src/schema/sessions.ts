import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { campaignsTable } from "./campaigns";
import { playersTable } from "./players";
import { charactersTable } from "./characters";

export const gameSessionsTable = pgTable("game_sessions", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaignsTable.id),
  playerId: integer("player_id").notNull().references(() => playersTable.id),
  characterId: integer("character_id").notNull().references(() => charactersTable.id),
  status: text("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const gameMessagesTable = pgTable("game_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => gameSessionsTable.id),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertGameSessionSchema = createInsertSchema(gameSessionsTable).omit({ id: true, createdAt: true, status: true });
export type InsertGameSession = z.infer<typeof insertGameSessionSchema>;
export type GameSession = typeof gameSessionsTable.$inferSelect;

export const insertGameMessageSchema = createInsertSchema(gameMessagesTable).omit({ id: true, createdAt: true });
export type InsertGameMessage = z.infer<typeof insertGameMessageSchema>;
export type GameMessage = typeof gameMessagesTable.$inferSelect;
