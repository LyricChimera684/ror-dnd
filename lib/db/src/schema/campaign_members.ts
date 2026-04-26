import { pgTable, serial, integer, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { campaignsTable } from "./campaigns";
import { playersTable } from "./players";
import { charactersTable } from "./characters";

export const campaignMembersTable = pgTable("campaign_members", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaignsTable.id),
  playerId: integer("player_id").notNull().references(() => playersTable.id),
  characterId: integer("character_id").notNull().references(() => charactersTable.id),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),

  campaignHp: integer("campaign_hp"),
  campaignMaxHp: integer("campaign_max_hp"),
  campaignLevel: integer("campaign_level"),
  campaignXp: integer("campaign_xp"),
  campaignIsDead: boolean("campaign_is_dead").default(false).notNull(),

  isLocked: boolean("is_locked").default(false).notNull(),
  canSwap: boolean("can_swap").default(false).notNull(),
}, (t) => [unique().on(t.campaignId, t.playerId)]);

export const insertCampaignMemberSchema = createInsertSchema(campaignMembersTable).omit({ id: true, joinedAt: true });
export type InsertCampaignMember = z.infer<typeof insertCampaignMemberSchema>;
export type CampaignMember = typeof campaignMembersTable.$inferSelect;
