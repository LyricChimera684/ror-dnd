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
import { eq, count, and } from "drizzle-orm";
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
  if (npcMatches.length === 0) return [];

  // Fetch existing NPCs ONCE up front, not per-match (avoids race + saves queries)
  const existing = await db.select().from(npcsTable).where(eq(npcsTable.sessionId, sessionId));
  const knownNames = new Set(existing.map((n) => n.name.toLowerCase()));
  const newNpcs = [];
  const seenInThisResponse = new Set<string>();

  for (const match of npcMatches) {
    const [, rawName, description, disposition] = match;
    const name = rawName.trim();
    const lower = name.toLowerCase();
    // Skip if already in DB OR already inserted earlier in this same response
    if (knownNames.has(lower) || seenInThisResponse.has(lower)) continue;
    seenInThisResponse.add(lower);

    const [npc] = await db
      .insert(npcsTable)
      .values({ sessionId, name, description: description.trim(), disposition: disposition.trim() })
      .returning();
    newNpcs.push(npc);
  }
  return newNpcs;
}

async function parseAndAddItems(characterId: number, narrative: string) {
  const itemMatches = [...narrative.matchAll(/\[ITEM:([^:]+):([^:]+):([^\]]+)\]/g)];
  if (itemMatches.length === 0) return [];

  // Fetch character's existing inventory once so we can stack same-named items
  const existing = await db
    .select()
    .from(inventoryItemsTable)
    .where(eq(inventoryItemsTable.characterId, characterId));
  const existingByName = new Map(existing.map((it) => [it.name.toLowerCase(), it]));

  // Dedupe matches within this response by lowercased name (count occurrences for stack qty)
  const wanted = new Map<string, { name: string; description: string; type: string; qty: number }>();
  for (const match of itemMatches) {
    const [, rawName, description, type] = match;
    const name = rawName.trim();
    const key = name.toLowerCase();
    const prev = wanted.get(key);
    if (prev) {
      prev.qty += 1;
    } else {
      wanted.set(key, { name, description: description.trim(), type: type.trim(), qty: 1 });
    }
  }

  const newItems = [];
  for (const [key, w] of wanted) {
    const existingItem = existingByName.get(key);
    if (existingItem) {
      // Already have this item — increment quantity instead of creating a duplicate row
      const [updated] = await db
        .update(inventoryItemsTable)
        .set({ quantity: (existingItem.quantity ?? 1) + w.qty })
        .where(eq(inventoryItemsTable.id, existingItem.id))
        .returning();
      newItems.push(updated);
    } else {
      const [item] = await db
        .insert(inventoryItemsTable)
        .values({ characterId, name: w.name, description: w.description, type: w.type, quantity: w.qty })
        .returning();
      newItems.push(item);
    }
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

  // Check for existing membership
  const [existingMember] = await db
    .select()
    .from(campaignMembersTable)
    .where(and(
      eq(campaignMembersTable.campaignId, campaignId),
      eq(campaignMembersTable.playerId, body.playerId)
    ))
    .limit(1);

  if (existingMember) {
    if (existingMember.isLocked && !existingMember.canSwap) {
      // Character is locked — send them to their existing session without changing anything
      const [existingSession] = await db
        .select()
        .from(gameSessionsTable)
        .where(eq(gameSessionsTable.campaignId, campaignId))
        .limit(1);
      if (existingSession) {
        res.json({ ...existingSession, characterLocked: true });
        return;
      }
    } else if (existingMember.canSwap) {
      // Safe haven — allow character swap, copy new character's base stats
      await db
        .update(campaignMembersTable)
        .set({
          characterId: body.characterId,
          campaignHp: character.hp,
          campaignMaxHp: character.maxHp,
          campaignLevel: character.level,
          campaignXp: character.xp,
          campaignIsDead: false,
          canSwap: false,
          isLocked: true,
          joinedAt: new Date(),
        })
        .where(eq(campaignMembersTable.id, existingMember.id));
    }
    // else: re-join with same character, just proceed normally
  } else {
    // New member — insert with campaign-specific stats copied from character baseline
    await db
      .insert(campaignMembersTable)
      .values({
        campaignId,
        playerId: body.playerId,
        characterId: body.characterId,
        campaignHp: character.hp,
        campaignMaxHp: character.maxHp,
        campaignLevel: character.level,
        campaignXp: character.xp,
        campaignIsDead: false,
        isLocked: true,
        canSwap: false,
      });
  }

  // Reuse existing shared session for this campaign if one already exists
  const [existingSession] = await db
    .select()
    .from(gameSessionsTable)
    .where(eq(gameSessionsTable.campaignId, campaignId))
    .limit(1);

  if (existingSession) {
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

  // Get the campaign-specific member record for this player
  const [campaignMember] = character
    ? await db
        .select()
        .from(campaignMembersTable)
        .where(and(
          eq(campaignMembersTable.campaignId, session.campaignId),
          eq(campaignMembersTable.playerId, character.playerId)
        ))
        .limit(1)
    : [undefined];

  // Use campaign-specific stats; fall back to global character stats for legacy entries
  const effectiveHp = campaignMember?.campaignHp ?? character?.hp ?? 20;
  const effectiveMaxHp = campaignMember?.campaignMaxHp ?? character?.maxHp ?? 20;
  const effectiveLevel = campaignMember?.campaignLevel ?? character?.level ?? 1;
  const effectiveXp = campaignMember?.campaignXp ?? character?.xp ?? 0;
  const effectiveIsDead = campaignMember?.campaignIsDead ?? character?.isDead ?? false;

  if (effectiveIsDead) {
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
      const memberHp = m.campaignHp ?? c?.hp ?? 0;
      const memberMaxHp = m.campaignMaxHp ?? c?.maxHp ?? 20;
      const memberLevel = m.campaignLevel ?? c?.level ?? 1;
      return c ? { ...c, hp: memberHp, maxHp: memberMaxHp, level: memberLevel } : null;
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

  const systemPrompt = `You are the Dungeon Master for a multiplayer D&D text adventure. You are firm but fair. Stay in character at all times. No compliments, no meta-commentary, no fluff — only story.

Campaign: "${campaign?.title}" — ${campaign?.description}
Setting: ${campaign?.setting}
Acting now: ${character?.name} (Lvl ${effectiveLevel} ${character?.race} ${character?.class}, HP ${effectiveHp}/${effectiveMaxHp}).${attrContext}${partyContext}${npcContext}${mapContext}${statusContext}

CORE RULES — these override player desires:

1. YOU CONTROL THE PACING, NOT THE PLAYER. The story unfolds at the pace YOU set. Players act within the current scene; they cannot skip ahead to future story beats just by declaring it.

2. NO TELEPORTING TO STORY BEATS. If a player tries to fast-forward ("I go to the boss", "I find the artifact", "I arrive at the castle", "I kill the villain"), the world refuses naturally: the path is unknown, miles of wilderness lie between, guards block the way, the player has no idea where to go, etc. Redirect them to the actual current scene. Never just grant the destination.

3. EVERY ACTION HAS CONSEQUENCES. Nothing is consequence-free. If a player does something random or off-topic mid-adventure (eats at a buffet, takes a nap in the street, browses shops while the city burns), something happens TO them or AROUND them: food poisoning sets in, a pickpocket strikes, a shady stranger sits down across from them, time passes and an ally is hurt, the trail goes cold, an enemy gains ground. Be specific and immediate.

4. THE WORLD PUSHES BACK ON UNREALISTIC OR GAME-BREAKING ACTIONS. If a player tries something impossible, absurd, or that would trivialize the adventure ("I one-shot the dragon", "I become king", "I have a nuke"), the world reacts: NPCs laugh, mock, or grow suspicious; physics refuses; obstacles appear; their reputation suffers. Never roll over.

5. STAY GROUNDED IN THE CURRENT SCENE. Always anchor your response in the immediate location, the people present, and what is actually happening NOW. Move the story forward only one beat at a time.

DICE: Only add [ROLL:XdY] for genuinely risky actions — direct combat attacks, dangerous physical feats (jumping a chasm, picking a lock under pressure), or contested checks where failure has real consequences. Do NOT request rolls for talking, walking, looking around, resting, or anything routine.
If a message starts with "🎲 Rolled" — narrate the result briefly, no new roll needed.

TAGS (only when genuinely applicable): [NPC:Name:desc:friendly/neutral/hostile] | [ITEM:Name:desc:type] | [LOCATION:Name] | [STATUS:EffectName:add/remove]
SAFE HAVEN: If the party is resting at a clear safe haven (inn, tavern, base, hotel, cottage, guild hall, monastery, barracks, palace — NOT campfire, forest, road, dungeon, cave, abandoned building, wilderness), append [SAFE_HAVEN] after the stat JSON.
END every response with JSON: {"xp":5,"hp":0} (xp 5-25, hp negative=damage/positive=heal/0=none)

LENGTH: 3-4 sentences maximum. No flowery prose, no compliments, just story.`;

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
    max_tokens: 320,
  });

  const rawResponse = completion.choices[0].message.content ?? "The Dungeon Master pauses...";

  // Detect safe haven signal
  const safeHavenDetected = /\[SAFE_HAVEN\]/i.test(rawResponse);

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
    .replace(/\[SAFE_HAVEN\]/gi, "")
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

  // Parse and apply status effect changes (on global character — cosmetic only)
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
  let updatedCampaignStats: { hp: number; maxHp: number; level: number; xp: number } | null = null;

  if (character) {
    const prevLevel = effectiveLevel;
    const newXp = effectiveXp + xpGained;
    const newLevel = Math.floor(newXp / 100) + 1;
    // Never decrease maxHp below the character's existing value (preserves class/CON bonuses)
    const baselineMaxHp = Math.max(effectiveMaxHp, newLevel * 20);
    const leveledUp = newLevel > prevLevel;
    // On level-up, grant +5 maxHp per level gained AND heal to full as a reward
    const newMaxHp = leveledUp
      ? baselineMaxHp + (newLevel - prevLevel) * 5
      : baselineMaxHp;
    const rawNewHp = effectiveHp + hpChange;
    const cappedHp = Math.max(0, Math.min(newMaxHp, rawNewHp));
    const newHp = leveledUp ? newMaxHp : cappedHp;
    isDead = rawNewHp <= 0;

    updatedCampaignStats = { hp: newHp, maxHp: newMaxHp, level: newLevel, xp: newXp };

    if (campaignMember) {
      // Update campaign-specific stats
      await db
        .update(campaignMembersTable)
        .set({
          campaignHp: newHp,
          campaignMaxHp: newMaxHp,
          campaignLevel: newLevel,
          campaignXp: newXp,
          campaignIsDead: isDead,
          canSwap: safeHavenDetected,
        })
        .where(eq(campaignMembersTable.id, campaignMember.id));
    } else {
      // Fallback: update global character stats for legacy entries without campaign membership
      await db
        .update(charactersTable)
        .set({ xp: newXp, hp: newHp, level: newLevel, maxHp: newMaxHp, isDead })
        .where(eq(charactersTable.id, character.id));
    }

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
    canSwap: safeHavenDetected,
    campaignStats: updatedCampaignStats,
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
