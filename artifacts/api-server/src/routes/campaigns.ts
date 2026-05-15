import { Router, type IRouter } from "express";
import { db, campaignsTable, discussionMessagesTable, playersTable, gameSessionsTable, gameMessagesTable, campaignMembersTable, journalEntriesTable, npcsTable, worldMapsTable, combatStatesTable } from "@workspace/db";
import { eq, or, inArray } from "drizzle-orm";
import { isAdmin } from "./players";
import {
  CreateCampaignBody,
  GetCampaignsQueryParams,
  GetCampaignParams,
  GetCampaignDiscussionParams,
  PostDiscussionMessageBody,
  PostDiscussionMessageParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/campaigns", async (req, res) => {
  const query = GetCampaignsQueryParams.parse(req.query);

  let campaignRows;
  if (query.playerId) {
    campaignRows = await db
      .select({
        campaign: campaignsTable,
        creatorUsername: playersTable.username,
      })
      .from(campaignsTable)
      .leftJoin(playersTable, eq(campaignsTable.creatorId, playersTable.id))
      .where(or(eq(campaignsTable.isPublic, true), eq(campaignsTable.creatorId, query.playerId)));
  } else {
    campaignRows = await db
      .select({
        campaign: campaignsTable,
        creatorUsername: playersTable.username,
      })
      .from(campaignsTable)
      .leftJoin(playersTable, eq(campaignsTable.creatorId, playersTable.id))
      .where(eq(campaignsTable.isPublic, true));
  }

  const campaigns = campaignRows.map(row => ({
    ...row.campaign,
    creatorUsername: row.creatorUsername || "Unknown",
  }));

  res.json(campaigns);
});

router.post("/campaigns", async (req, res) => {
  const body = CreateCampaignBody.parse(req.body);

  const [campaign] = await db
    .insert(campaignsTable)
    .values({
      title: body.title,
      description: body.description,
      setting: body.setting,
      isPublic: body.isPublic,
      creatorId: body.creatorId,
      inviteCode: body.inviteCode ?? null,
      dmType: (body.dmType as "ai" | "player") ?? "ai",
      humanDmId: body.humanDmId ?? null,
    })
    .returning();

  res.status(201).json(campaign);
});

router.get("/campaigns/:campaignId", async (req, res) => {
  const { campaignId } = GetCampaignParams.parse({ campaignId: req.params.campaignId });

  const [row] = await db
    .select({
      campaign: campaignsTable,
      creatorUsername: playersTable.username,
    })
    .from(campaignsTable)
    .leftJoin(playersTable, eq(campaignsTable.creatorId, playersTable.id))
    .where(eq(campaignsTable.id, campaignId))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  const campaign = {
    ...row.campaign,
    creatorUsername: row.creatorUsername || "Unknown",
  };

  res.json(campaign);
});

// Owner-only campaign deletion
router.delete("/campaigns/:campaignId", async (req, res) => {
  const campaignId = parseInt(req.params.campaignId);
  if (!Number.isFinite(campaignId)) {
    res.status(400).json({ error: "Invalid campaignId" });
    return;
  }

  const requesterId = Number(req.query.requesterId ?? req.body?.requesterId);
  if (!requesterId) {
    res.status(400).json({ error: "requesterId required" });
    return;
  }

  const [campaign] = await db
    .select({ id: campaignsTable.id, title: campaignsTable.title, creatorId: campaignsTable.creatorId })
    .from(campaignsTable)
    .where(eq(campaignsTable.id, campaignId))
    .limit(1);

  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  if (campaign.creatorId !== requesterId) {
    res.status(403).json({ error: "You can only delete your own campaigns." });
    return;
  }

  // Delete in FK dependency order
  const sessions = await db
    .select({ id: gameSessionsTable.id })
    .from(gameSessionsTable)
    .where(eq(gameSessionsTable.campaignId, campaignId));

  if (sessions.length > 0) {
    const sessionIds = sessions.map(s => s.id);
    await db.delete(gameMessagesTable).where(inArray(gameMessagesTable.sessionId, sessionIds));
    await db.delete(journalEntriesTable).where(inArray(journalEntriesTable.sessionId, sessionIds));
    await db.delete(npcsTable).where(inArray(npcsTable.sessionId, sessionIds));
    await db.delete(worldMapsTable).where(inArray(worldMapsTable.sessionId, sessionIds));
    await db.delete(combatStatesTable).where(inArray(combatStatesTable.sessionId, sessionIds));
  }

  await db.delete(gameSessionsTable).where(eq(gameSessionsTable.campaignId, campaignId));
  await db.delete(campaignMembersTable).where(eq(campaignMembersTable.campaignId, campaignId));
  await db.delete(discussionMessagesTable).where(eq(discussionMessagesTable.campaignId, campaignId));

  await db.delete(campaignsTable).where(eq(campaignsTable.id, campaignId));

  res.json({ success: true, message: `Campaign '${campaign.title}' deleted`, campaignId });
});

router.get("/campaigns/:campaignId/discussion", async (req, res) => {
  const { campaignId } = GetCampaignDiscussionParams.parse({ campaignId: req.params.campaignId });

  const messages = await db
    .select()
    .from(discussionMessagesTable)
    .where(eq(discussionMessagesTable.campaignId, campaignId))
    .orderBy(discussionMessagesTable.createdAt);

  res.json(messages);
});

router.post("/campaigns/:campaignId/discussion", async (req, res) => {
  const { campaignId } = PostDiscussionMessageParams.parse({ campaignId: req.params.campaignId });
  const body = PostDiscussionMessageBody.parse(req.body);

  const [msg] = await db
    .insert(discussionMessagesTable)
    .values({
      campaignId,
      playerId: body.playerId,
      username: body.username,
      message: body.message,
    })
    .returning();

  res.status(201).json(msg);
});

// ─── Admin Routes ────────────────────────────────────────────────────────────

router.get("/admin/campaigns", async (req, res) => {
  const { adminId } = req.query as { adminId?: string };

  if (!adminId) {
    res.status(400).json({ error: "adminId query parameter required" });
    return;
  }

  const [admin] = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.id, parseInt(adminId)))
    .limit(1);

  if (!admin || !isAdmin(admin)) {
    res.status(403).json({ error: "Forbidden: Admin access required" });
    return;
  }

  const campaigns = await db
    .select({
      id: campaignsTable.id,
      title: campaignsTable.title,
      description: campaignsTable.description,
      setting: campaignsTable.setting,
      isPublic: campaignsTable.isPublic,
      creatorId: campaignsTable.creatorId,
      createdAt: campaignsTable.createdAt,
    })
    .from(campaignsTable);

  res.json(campaigns);
});

router.delete("/admin/delete-campaign", async (req, res) => {
  const { adminId, campaignId } = req.body as { adminId?: number; campaignId?: number };

  if (!adminId || !campaignId) {
    res.status(400).json({ error: "adminId and campaignId required" });
    return;
  }

  const [admin] = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.id, adminId))
    .limit(1);

  if (!admin || !isAdmin(admin)) {
    res.status(403).json({ error: "Forbidden: Admin access required" });
    return;
  }

  const sessions = await db
    .select({ id: gameSessionsTable.id })
    .from(gameSessionsTable)
    .where(eq(gameSessionsTable.campaignId, campaignId));

  if (sessions.length > 0) {
    const sessionIds = sessions.map(s => s.id);
    await db.delete(gameMessagesTable).where(inArray(gameMessagesTable.sessionId, sessionIds));
    await db.delete(journalEntriesTable).where(inArray(journalEntriesTable.sessionId, sessionIds));
    await db.delete(npcsTable).where(inArray(npcsTable.sessionId, sessionIds));
    await db.delete(worldMapsTable).where(inArray(worldMapsTable.sessionId, sessionIds));
    await db.delete(combatStatesTable).where(inArray(combatStatesTable.sessionId, sessionIds));
  }

  await db.delete(gameSessionsTable).where(eq(gameSessionsTable.campaignId, campaignId));
  await db.delete(campaignMembersTable).where(eq(campaignMembersTable.campaignId, campaignId));
  await db.delete(discussionMessagesTable).where(eq(discussionMessagesTable.campaignId, campaignId));

  const [deleted] = await db
    .delete(campaignsTable)
    .where(eq(campaignsTable.id, campaignId))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  res.json({ success: true, message: `Campaign '${deleted.title}' deleted`, campaignId: deleted.id });
});

export default router;
