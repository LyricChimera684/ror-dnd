import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { playersTable } from "./players";

export const charactersTable = pgTable("characters", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id),
  name: text("name").notNull(),
  race: text("race").notNull(),
  class: text("class").notNull(),
  backstory: text("backstory"),
  level: integer("level").default(1).notNull(),
  hp: integer("hp").default(20).notNull(),
  maxHp: integer("max_hp").default(20).notNull(),
  xp: integer("xp").default(0).notNull(),
  isDead: boolean("is_dead").default(false).notNull(),
  attributes: json("attributes"),
  spellSlots: json("spell_slots"),
  statusEffects: json("status_effects").default([]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCharacterSchema = createInsertSchema(charactersTable).omit({ id: true, createdAt: true, level: true, hp: true, maxHp: true, xp: true, isDead: true });
export type InsertCharacter = z.infer<typeof insertCharacterSchema>;
export type Character = typeof charactersTable.$inferSelect;
