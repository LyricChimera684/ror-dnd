import { Router, type IRouter } from "express";
import {
  db,
  gameSessionsTable,
  gameMessagesTable,
  campaignsTable,
  charactersTable,
  npcsTable,
  journalEntriesTable,
  achievementsTable,
  inventoryItemsTable,
  worldMapsTable,
  campaignMembersTable,
} from "@workspace/db";
import { eq, count } from "drizzle-orm";
import {
  JoinCampaignParams,
  JoinCampaignBody,
  PerformActionParams,
  PerformActionBody,
  GetSessionHistoryParams,
} from "@workspace/api-zod";
import Groq from "groq-sdk";

const router: IRouter = Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function checkAndAwardAchievements(characterId: number, actionCount: number, xp: number, leveledUp: boolean, isDead: boolean) {
  const existing = await db.select().from(achievementsTable).where(eq(achievementsTable.characterId, characterId));
  const existingTitles = new Set(existing.map((a) => a.title));
  const toAward: { title: string; description: string; icon: string }[] = [];

  if (actionCount === 1 && !existingTitles.has("First Steps")) {
    toAward.push({ title: "First Steps", description: "Took your first action in the world.", icon: "🌟" });
  }
  if (actionCount >= 10 && !existingTitles.has("Seasoned Adventurer")) {
    toAward.push({ title: "Seasoned Adventurer", description: "Survived 10 actions in the realm.", icon: "⚔️" });
  }
  if (actionCount >= 50 && !existingTitles.has("Legend in the Making")) {
    toAward.push({ title: "Legend in the Making", description: "50 actions — your tale grows long.", icon: "📜" });
  }
  if (xp >= 100 && !existingTitles.has("Level Up!")) {
    toAward.push({ title: "Level Up!", description: "Reached level 2 for the first time.", icon: "⬆️" });
  }
  if (xp >= 500 && !existingTitles.has("Veteran")) {
    toAward.push({ title: "Veteran", description: "Accumulated 500 total XP.", icon: "🏅" });
  }
  if (leveledUp && !existingTitles.has("Power Surge")) {
    toAward.push({ title: "Power Surge", description: "Gained a level mid-adventure.", icon: "💥" });
  }
  if (isDead && !existingTitles.has("The Unfortunate")) {
    toAward.push({ title: "The Unfortunate", description: "Met an untimely end. Legends remember you.", icon: "💀" });
  }

  if (toAward.length === 0) return [];

  const awarded = await db
    .insert(achievementsTable)
    .values(toAward.map((a) => ({ characterId, ...a })))
    .returning();

  return awarded;
}

async function maybeGenerateJournalEntry(sessionId: number, actionCount: number) {
  if (actionCount % 5 !== 0) return;

  const recentMessages = await db
    .select()
    .from(gameMessagesTable)
    .where(eq(gameMessagesTable.sessionId, sessionId))
    .orderBy(gameMessagesTable.createdAt);

  const last10 = recentMessages.slice(-10);
  const transcript = last10.map((m) => `${m.role === "user" ? "Player" : "DM"}: ${m.content}`).join("\n");

  const summaryResponse = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "user",
        content: `Summarize this D&D adventure segment in 2 sentences for a campaign journal. Third-person, vivid. Output only the summary.\n\n${transcript}`,
      },
    ],
    max_tokens: 100,
  });

  const summary = summaryResponse.choices[0].message.content?.trim() ?? "The adventure continued...";
  await db.insert(journalEntriesTable).values({ sessionId, summary });
}

async function updateWorldMap(sessionId: number, narrative: string) {
  const locationMatch = narrative.match(/\[LOCATION:([^\]]+)\]/);
  if (!locationMatch) return null;

  const newLocation = locationMatch[1].trim();
  const [existing] = await db.select().from(worldMapsTable).where(eq(worldMapsTable.sessionId, sessionId)).limit(1);

  if (existing) {
    const locations = existing.locations as string[];
    if (!locations.includes(newLocation)) {
      locations.push(newLocation);
    }
    await db
      .update(worldMapsTable)
      .set({ locations, currentLocation: newLocation, updatedAt: new Date() })
      .where(eq(worldMapsTable.sessionId, sessionId));
  } else {
    await db.insert(worldMapsTable).values({
      sessionId,
      locations: [newLocation],
      currentLocation: newLocation,
    });
  }
  return newLocation;
}

async function updateNpcs(sessionId: number, narrative: string) {
  const npcMatches = [...narrative.matchAll(/\[NPC:([^:]+):([^:]+):([^\]]+)\]/g)];
  const newNpcs = [];

  for (const match of npcMatches) {
    const [, name, description, disposition] = match;
    const existing = await db.select().from(npcsTable).where(eq(npcsTable.sessionId, sessionId));
    const alreadyKnown = existing.some((n) => n.name.toLowerCase() === name.trim().toLowerCase());
    if (!alreadyKnown) {
      const [npc] = await db
        .insert(npcsTable)
        .values({ sessionId, name: name.trim(), description: description.trim(), disposition: disposition.trim() })
        .returning();
      newNpcs.push(npc);
    }
  }
  return newNpcs;
}

async function parseAndAddItems(characterId: number, narrative: string) {
  const itemMatches = [...narrative.matchAll(/\[ITEM:([^:]+):([^:]+):([^\]]+)\]/g)];
  const newItems = [];

  for (const match of itemMatches) {
    const [, name, description, type] = match;
    const [item] = await db
      .insert(inventoryItemsTable)
      .values({ characterId, name: name.trim(), description: description.trim(), type: type.trim(), quantity: 1 })
      .returning();
    newItems.push(item);
  }
  return newItems;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

router.post("/campaigns/:campaignId/join", async (req, res) => {
  const { campaignId } = JoinCampaignParams.parse({ campaignId: req.params.campaignId });
  const body = JoinCampaignBody.parse(req.body);

  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, campaignId)).limit(1);
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  if (!campaign.isPublic) {
    if (!body.inviteCode || body.inviteCode !== campaign.inviteCode) {
      res.status(403).json({ error: "Invalid invite code for private campaign" });
      return;
    }
  }

  const [character] = await db.select().from(charactersTable).where(eq(charactersTable.id, body.characterId)).limit(1);
  if (!character) {
    res.status(404).json({ error: "Character not found" });
    return;
  }

  // Track this player's membership (upsert — update characterId if they switch characters)
  await db
    .insert(campaignMembersTable)
    .values({ campaignId, playerId: body.playerId, characterId: body.characterId })
    .onConflictDoUpdate({
      target: [campaignMembersTable.campaignId, campaignMembersTable.playerId],
      set: { characterId: body.characterId, joinedAt: new Date() },
    });

  // Reuse existing shared session for this campaign if one already exists
  const [existingSession] = await db
    .select()
    .from(gameSessionsTable)
    .where(eq(gameSessionsTable.campaignId, campaignId))
    .limit(1);

  if (existingSession) {
    // Returning player — just drop them into the existing session
    res.json(existingSession);
    return;
  }

  // First player — create the shared session and generate the opening scene
  const [session] = await db
    .insert(gameSessionsTable)
    .values({ campaignId, playerId: body.playerId, characterId: body.characterId })
    .returning();

  const introPrompt = `You are a Dungeon Master for a D&D text adventure. Be BRIEF — 2 short sentences max.
Campaign: "${campaign.title}" — ${campaign.description}
Setting: ${campaign.setting}
This is a MULTIPLAYER campaign. Opening character: ${character.name}, a ${character.race} ${character.class}.

Set the opening scene in 1-2 sentences. Include a [LOCATION:Name] tag.`;

  const introResponse = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: introPrompt }],
    max_tokens: 200,
  });

  const introRaw = introResponse.choices[0].message.content ?? "Your adventure begins...";
  const introNarrative = introRaw.replace(/\[LOCATION:[^\]]+\]/g, "").trim();

  await db.insert(gameMessagesTable).values({ sessionId: session.id, role: "assistant", content: introNarrative });
  await updateWorldMap(session.id, introRaw);

  res.json(session);
});

router.post("/sessions/:sessionId/action", async (req, res) => {
  const { sessionId } = PerformActionParams.parse({ sessionId: req.params.sessionId });
  const body = PerformActionBody.parse(req.body);

  const [session] = await db.select().from(gameSessionsTable).where(eq(gameSessionsTable.id, sessionId)).limit(1);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, session.campaignId)).limit(1);

  // Use the characterId from the request (acting player's character), fall back to session's character
  const characterId = body.characterId ?? session.characterId;
  const [character] = await db.select().from(charactersTable).where(eq(charactersTable.id, characterId)).limit(1);

  if (character?.isDead) {
    res.json({
      narrative: "Your character has fallen. Death claims you... for now.",
      sessionId,
      isDead: true,
      newAchievements: [],
      newItems: [],
    });
    return;
  }

  // Load all campaign members so DM knows the full party
  const members = await db
    .select()
    .from(campaignMembersTable)
    .where(eq(campaignMembersTable.campaignId, session.campaignId));
  const memberChars = await Promise.all(
    members.map(async (m) => {
      const [c] = await db.select().from(charactersTable).where(eq(charactersTable.id, m.characterId)).limit(1);
      return c;
    })
  );
  const partyContext = memberChars.filter(Boolean).length > 1
    ? `\nParty members: ${memberChars.filter(Boolean).map((c) => `${c!.name} (Lvl ${c!.level} ${c!.race} ${c!.class}, HP ${c!.hp}/${c!.maxHp})`).join(", ")}`
    : "";

  const knownNpcs = await db.select().from(npcsTable).where(eq(npcsTable.sessionId, sessionId));
  const npcContext = knownNpcs.length > 0
    ? `\nKnown NPCs: ${knownNpcs.map((n) => `${n.name} (${n.disposition})`).join(", ")}`
    : "";

  const [mapState] = await db.select().from(worldMapsTable).where(eq(worldMapsTable.sessionId, sessionId)).limit(1);
  const mapContext = mapState?.currentLocation ? `\nLocation: ${mapState.currentLocation}` : "";

  const history = await db
    .select()
    .from(gameMessagesTable)
    .where(eq(gameMessagesTable.sessionId, sessionId))
    .orderBy(gameMessagesTable.createdAt);

  const [actionCountResult] = await db
    .select({ count: count() })
    .from(gameMessagesTable)
    .where(eq(gameMessagesTable.sessionId, sessionId));
  const actionCount = Number(actionCountResult?.count ?? 0);

  const attrs = character?.attributes as Record<string, number> | null;
  const attrContext = attrs
    ? ` STR:${attrs.str} DEX:${attrs.dex} CON:${attrs.con} INT:${attrs.int} WIS:${attrs.wis} CHA:${attrs.cha}.`
    : "";
  const statusArr = (character?.statusEffects as string[]) ?? [];
  const statusContext = statusArr.length > 0 ? `\nStatus effects: ${statusArr.join(", ")}.` : "";

  const systemPrompt = `You are a DM for a multiplayer D&D text adventure. Be BRIEF — 1-2 sentences max. No flowery prose.

Campaign: "${campaign?.title}" — ${campaign?.description}
Setting: ${campaign?.setting}
Acting now: ${character?.name} (Lvl ${character?.level} ${character?.race} ${character?.class}, HP ${character?.hp}/${character?.maxHp}).${attrContext}${partyContext}${npcContext}${mapContext}${statusContext}

DICE: Only add [ROLL:XdY] for direct combat attacks, dangerous physical feats (jumping a chasm, picking a lock under pressure), or contested checks where failure has real consequences. Do NOT request rolls for talking, walking, looking around, resting, or anything routine.
If message starts with "🎲 Rolled" — narrate the result briefly, no new roll needed.
TAGS (only when genuinely applicable): [NPC:Name:desc:friendly/neutral/hostile] | [ITEM:Name:desc:type] | [LOCATION:Name] | [STATUS:EffectName:add/remove]
END every response with JSON: {"xp":5,"hp":0} (xp 5-25, hp negative=damage/positive=heal/0=none)

Keep responses punchy and reactive. Max 2 sentences.`;

  // Store the action prefixed with the character's name so all players can see who acted
  const prefixedAction = `**${character?.name ?? "Adventurer"}**: ${body.action}`;
  await db.insert(gameMessagesTable).values({ sessionId, role: "user", content: prefixedAction });

  // Cap history to last 20 messages to limit token usage as sessions grow
  const recentHistory = history.slice(-20);

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt },
    ...recentHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: prefixedAction },
  ];

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages,
    max_tokens: 200,
  });

  const rawResponse = completion.choices[0].message.content ?? "The Dungeon Master pauses...";

  // Parse dice request
  const diceMatch = rawResponse.match(/\[ROLL:(\d+d\d+)\]/i);
  const diceRequest = diceMatch ? diceMatch[1] : undefined;

  // Parse stats JSON
  const jsonMatch = rawResponse.match(/\{"xp":\d+,"hp":-?\d+\}/);
  let xpGained = 5;
  let hpChange = 0;
  let narrative = rawResponse;

  // Strip all special tags from displayed narrative
  narrative = narrative
    .replace(/\[ROLL:\d+d\d+\]/gi, "")
    .replace(/\[NPC:[^\]]+\]/g, "")
    .replace(/\[ITEM:[^\]]+\]/g, "")
    .replace(/\[LOCATION:[^\]]+\]/g, "")
    .replace(/\[STATUS:[^\]]+\]/g, "")
    .trim();

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      xpGained = parsed.xp ?? 5;
      hpChange = parsed.hp ?? 0;
      narrative = narrative.replace(jsonMatch[0], "").trim();
    } catch {
      // keep defaults
    }
  }

  await db.insert(gameMessagesTable).values({ sessionId, role: "assistant", content: narrative });

  // Parse and apply status effect changes
  if (character) {
    const statusMatches = [...rawResponse.matchAll(/\[STATUS:([^:]+):(add|remove)\]/gi)];
    if (statusMatches.length > 0) {
      let currentEffects: string[] = (character.statusEffects as string[]) ?? [];
      for (const match of statusMatches) {
        const effect = match[1].trim();
        const action = match[2].toLowerCase();
        if (action === "add" && !currentEffects.includes(effect)) {
          currentEffects = [...currentEffects, effect];
        } else if (action === "remove") {
          currentEffects = currentEffects.filter((e) => e !== effect);
        }
      }
      await db.update(charactersTable).set({ statusEffects: currentEffects }).where(eq(charactersTable.id, character.id));
    }
  }

  // Update NPC memory and world map
  const [newNpcs, newLocation] = await Promise.all([
    updateNpcs(sessionId, rawResponse),
    updateWorldMap(sessionId, rawResponse),
  ]);

  let newAchievements: typeof achievementsTable.$inferSelect[] = [];
  let newItems: typeof inventoryItemsTable.$inferSelect[] = [];
  let isDead = false;

  if (character) {
    const prevLevel = character.level;
    const newXp = character.xp + xpGained;
    const newLevel = Math.floor(newXp / 100) + 1;
    const newMaxHp = newLevel * 20;
    const rawNewHp = character.hp + hpChange;
    const newHp = Math.max(0, Math.min(newMaxHp, rawNewHp));
    isDead = rawNewHp <= 0;
    const leveledUp = newLevel > prevLevel;

    await db
      .update(charactersTable)
      .set({ xp: newXp, hp: newHp, level: newLevel, maxHp: newMaxHp, isDead })
      .where(eq(charactersTable.id, character.id));

    const [journalTask, itemsTask, achievementsTask] = await Promise.all([
      maybeGenerateJournalEntry(sessionId, actionCount + 1),
      parseAndAddItems(character.id, rawResponse),
      checkAndAwardAchievements(character.id, actionCount + 1, newXp, leveledUp, isDead),
    ]);

    newItems = itemsTask;
    newAchievements = achievementsTask;
  }

  res.json({
    narrative,
    sessionId,
    xpGained,
    hpChange,
    diceRequest,
    isDead,
    newAchievements,
    newItems,
    newLocation,
  });
});

router.get("/sessions/:sessionId/history", async (req, res) => {
  const { sessionId } = GetSessionHistoryParams.parse({ sessionId: req.params.sessionId });
  const messages = await db
    .select()
    .from(gameMessagesTable)
    .where(eq(gameMessagesTable.sessionId, sessionId))
    .orderBy(gameMessagesTable.createdAt);
  res.json(messages);
});

export default router;