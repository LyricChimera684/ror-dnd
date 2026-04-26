import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { charactersTable } from "./characters";

export const achievementsTable = pgTable("achievements", {
  id: serial("id").primaryKey(),
  characterId: integer("character_id").notNull().references(() => charactersTable.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull().default("⚔️"),
  unlockedAt: timestamp("unlocked_at").defaultNow().notNull(),
});

export const insertAchievementSchema = createInsertSchema(achievementsTable).omit({ id: true, unlockedAt: true });
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
export type Achievement = typeof achievementsTable.$inferSelect;
