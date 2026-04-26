import { Router, type IRouter } from "express";
import {
  db,
  npcsTable,
  journalEntriesTable,
  combatStatesTable,
  worldMapsTable,
  gameSessionsTable,
  gameMessagesTable,
  campaignsTable,
  campaignMembersTable,
  charactersTable,
  playersTable,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import {
  GetSessionNpcsParams,
  GetSessionJournalParams,
  GetSessionMapParams,
  GetCombatStateParams,
  UpdateCombatStateParams,
  UpdateCombatStateBody,
  GetCampaignPartyParams,
  DmInjectEventParams,
  DmInjectEventBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/sessions/:sessionId/npcs", async (req, res) => {
  const { sessionId } = GetSessionNpcsParams.parse({ sessionId: req.params.sessionId });
  const npcs = await db.select().from(npcsTable).where(eq(npcsTable.sessionId, sessionId)).orderBy(npcsTable.createdAt);
  res.json(npcs);
});

router.get("/sessions/:sessionId/journal", async (req, res) => {
  const { sessionId } = GetSessionJournalParams.parse({ sessionId: req.params.sessionId });
  const entries = await db
    .select()
    .from(journalEntriesTable)
    .where(eq(journalEntriesTable.sessionId, sessionId))
    .orderBy(journalEntriesTable.createdAt);
  res.json(entries);
});

router.get("/sessions/:sessionId/map", async (req, res) => {
  const { sessionId } = GetSessionMapParams.parse({ sessionId: req.params.sessionId });
  const [map] = await db.select().from(worldMapsTable).where(eq(worldMapsTable.sessionId, sessionId)).limit(1);
  if (!map) {
    res.json({ sessionId, locations: [], currentLocation: null, ascii: null });
    return;
  }
  res.json({
    sessionId: map.sessionId,
    locations: map.locations as string[],
    currentLocation: map.currentLocation,
    ascii: map.ascii,
  });
});

router.get("/sessions/:sessionId/combat", async (req, res) => {
  const { sessionId } = GetCombatStateParams.parse({ sessionId: req.params.sessionId });
  const [state] = await db.select().from(combatStatesTable).where(eq(combatStatesTable.sessionId, sessionId)).limit(1);
  if (!state) {
    res.json({ sessionId, active: false, round: 1, combatants: [] });
    return;
  }
  res.json({ sessionId: state.sessionId, active: state.active, round: state.round, combatants: state.combatants });
});

router.put("/sessions/:sessionId/combat", async (req, res) => {
  const { sessionId } = UpdateCombatStateParams.parse({ sessionId: req.params.sessionId });
  const body = UpdateCombatStateBody.parse(req.body);

  const [existing] = await db.select().from(combatStatesTable).where(eq(combatStatesTable.sessionId, sessionId)).limit(1);

  if (existing) {
    const [updated] = await db
      .update(combatStatesTable)
      .set({ active: body.active, round: body.round, combatants: body.combatants, updatedAt: new Date() })
      .where(eq(combatStatesTable.sessionId, sessionId))
      .returning();
    res.json({ sessionId: updated.sessionId, active: updated.active, round: updated.round, combatants: updated.combatants });
  } else {
    const [created] = await db
      .insert(combatStatesTable)
      .values({ sessionId, active: body.active, round: body.round, combatants: body.combatants })
      .returning();
    res.json({ sessionId: created.sessionId, active: created.active, round: created.round, combatants: created.combatants });
  }
});

router.get("/campaigns/:campaignId/party", async (req, res) => {
  const { campaignId } = GetCampaignPartyParams.parse({ campaignId: req.params.campaignId });

  const memberships = await db
    .select()
    .from(campaignMembersTable)
    .where(eq(campaignMembersTable.campaignId, campaignId));

  const members = await Promise.all(
    memberships.map(async (membership) => {
      const [character] = await db
        .select()
        .from(charactersTable)
        .where(eq(charactersTable.id, membership.characterId))
        .limit(1);
      const [player] = await db
        .select()
        .from(playersTable)
        .where(eq(playersTable.id, membership.playerId))
        .limit(1);
      return {
        playerId: membership.playerId,
        username: player?.username ?? "Unknown",
        characterName: character?.name ?? "Unknown",
        race: character?.race ?? "Unknown",
        class: character?.class ?? "Unknown",
        level: membership.campaignLevel ?? character?.level ?? 1,
        hp: membership.campaignHp ?? character?.hp ?? 0,
        maxHp: membership.campaignMaxHp ?? character?.maxHp ?? 20,
        xp: membership.campaignXp ?? character?.xp ?? 0,
        isDead: membership.campaignIsDead ?? character?.isDead ?? false,
      };
    })
  );

  res.json(members);
});

router.get("/campaigns/:campaignId/member-stats", async (req, res) => {
  const campaignId = parseInt(req.params.campaignId);
  const playerId = parseInt(req.query.playerId as string);
  if (!campaignId || !playerId) {
    res.status(400).json({ error: "campaignId and playerId required" });
    return;
  }
  const [member] = await db
    .select()
    .from(campaignMembersTable)
    .where(and(
      eq(campaignMembersTable.campaignId, campaignId),
      eq(campaignMembersTable.playerId, playerId)
    ))
    .limit(1);
  if (!member) {
    res.status(404).json({ error: "Not a member of this campaign" });
    return;
  }
  const [character] = await db
    .select()
    .from(charactersTable)
    .where(eq(charactersTable.id, member.characterId))
    .limit(1);
  res.json({
    characterId: member.characterId,
    characterName: character?.name ?? "Unknown",
    hp: member.campaignHp ?? character?.hp ?? 20,
    maxHp: member.campaignMaxHp ?? character?.maxHp ?? 20,
    level: member.campaignLevel ?? character?.level ?? 1,
    xp: member.campaignXp ?? character?.xp ?? 0,
    isDead: member.campaignIsDead,
    isLocked: member.isLocked,
    canSwap: member.canSwap,
  });
});

router.post("/campaigns/:campaignId/dm-inject", async (req, res) => {
  const { campaignId } = DmInjectEventParams.parse({ campaignId: req.params.campaignId });
  const body = DmInjectEventBody.parse(req.body);

  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.id, campaignId))
    .limit(1);

  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  if (campaign.creatorId !== body.creatorId) {
    res.status(403).json({ error: "Only the campaign creator can inject events" });
    return;
  }

  const sessions = await db
    .select()
    .from(gameSessionsTable)
    .where(eq(gameSessionsTable.campaignId, campaignId));

  const dmMessage = `[DM EVENT] ${body.event}`;
  await Promise.all(
    sessions.map((session) =>
      db.insert(gameMessagesTable).values({
        sessionId: session.id,
        role: "assistant",
        content: dmMessage,
      })
    )
  );

  res.json({ success: true, message: `Event injected into ${sessions.length} sessions` });
});

export default router;
