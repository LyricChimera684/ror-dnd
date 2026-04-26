import { Router, type IRouter } from "express";
import { db, playersTable, charactersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreatePlayerBody,
  GetPlayerParams,
  GetPlayerCharactersParams,
  CreateCharacterBody,
  CreateCharacterParams,
  ValidateCharacterBody,
} from "@workspace/api-zod";
import crypto from "crypto";
import Groq from "groq-sdk";
import { getAuth } from "@clerk/express";

const router: IRouter = Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "dnd-salt-2025").digest("hex");
}

export function isAdmin(player: { role?: string }): boolean {
  return String(player.role ?? "").toLowerCase() === "admin";
}

router.post("/players", async (req, res) => {
  const body = CreatePlayerBody.parse(req.body);
  const hash = hashPassword(body.password);

  const existing = await db
    .select({ id: playersTable.id })
    .from(playersTable)
    .where(eq(playersTable.username, body.username))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "Username already taken. Choose a different name." });
    return;
  }

  const [player] = await db
    .insert(playersTable)
    .values({ username: body.username, passwordHash: hash, role: "player" })
    .returning();

  const { passwordHash: _, ...safePlayer } = player;
  res.json(safePlayer);
});

router.post("/players/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required." });
    return;
  }
  const hash = hashPassword(password);
  const [player] = await db
    .select({
      id: playersTable.id,
      username: playersTable.username,
      role: playersTable.role,
      passwordHash: playersTable.passwordHash,
    })
    .from(playersTable)
    .where(eq(playersTable.username, username))
    .limit(1);

  if (!player) {
    res.status(404).json({ error: "Account not found. Please sign up first." });
    return;
  }
  if (!player.passwordHash || player.passwordHash !== hash) {
    res.status(401).json({ error: "Invalid password." });
    return;
  }
  const { passwordHash: _, ...safePlayer } = player;
  res.json(safePlayer);
});

router.post("/players/clerk-sync", async (req, res) => {
  const clerkAuth = getAuth(req);
  if (!clerkAuth.userId) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }
  const clerkId = clerkAuth.userId;

  const [existing] = await db
    .select({ id: playersTable.id, username: playersTable.username, role: playersTable.role })
    .from(playersTable)
    .where(eq(playersTable.clerkId, clerkId))
    .limit(1);

  if (existing) {
    res.json(existing);
    return;
  }

  const { displayName, email } = req.body as { displayName?: string; email?: string };
  let baseUsername = (displayName || (email ? email.split("@")[0] : "") || "adventurer")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .slice(0, 20) || "adventurer";

  let username = baseUsername;
  let suffix = 1;
  while (true) {
    const [taken] = await db
      .select({ id: playersTable.id })
      .from(playersTable)
      .where(eq(playersTable.username, username))
      .limit(1);
    if (!taken) break;
    username = `${baseUsername}${suffix++}`;
  }

  const [player] = await db
    .insert(playersTable)
    .values({ username, passwordHash: null, clerkId, role: "player" })
    .returning({ id: playersTable.id, username: playersTable.username, role: playersTable.role });

  res.json(player);
});

router.get("/players/:playerId", async (req, res) => {
  const { playerId } = GetPlayerParams.parse({ playerId: req.params.playerId });

  const [player] = await db
    .select({ id: playersTable.id, username: playersTable.username, role: playersTable.role, createdAt: playersTable.createdAt })
    .from(playersTable)
    .where(eq(playersTable.id, playerId))
    .limit(1);

  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  res.json(player);
});

router.get("/players/:playerId/characters", async (req, res) => {
  const { playerId } = GetPlayerCharactersParams.parse({ playerId: req.params.playerId });

  const characters = await db
    .select()
    .from(charactersTable)
    .where(eq(charactersTable.playerId, playerId));

  res.json(characters);
});

router.post("/players/:playerId/characters/validate", async (req, res) => {
  const body = ValidateCharacterBody.parse(req.body);

  const prompt = `You are a D&D game master validator. A player wants to create a character with the following attributes:
Name: "${body.name}"
Race: "${body.race}"
Class: "${body.class}"
${body.backstory ? `Backstory: "${body.backstory}"` : ""}

Your job is to decide if this character is acceptable for a D&D-style text adventure. 
Be VERY permissive — allow creative, unusual, funny, or fantastical choices (cat, alien, robot, sentient sandwich, etc.). 
Only reject characters that are:
- Completely meaningless/empty (e.g. race: "asdfjkl;")
- Intentionally offensive or inappropriate
- The name, race, or class is just gibberish with no creative intent

If valid, briefly describe how you'd interpret this character in a fantasy world (1-2 sentences, be creative and fun).
If invalid, explain why and suggest an alternative.

Respond ONLY with JSON in this exact format:
{"valid": true, "message": "Your interpretation/welcome message", "suggestion": null}
OR
{"valid": false, "message": "Reason it was rejected", "suggestion": "Alternative suggestion"}`;

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 200,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0].message.content ?? '{"valid":false,"message":"Could not validate","suggestion":null}';
  const parsed = JSON.parse(raw);

  res.json({
    valid: parsed.valid ?? false,
    message: parsed.message ?? "Unknown",
    suggestion: parsed.suggestion ?? undefined,
  });
});

router.post("/players/:playerId/characters", async (req, res) => {
  const { playerId } = CreateCharacterParams.parse({ playerId: req.params.playerId });
  const body = CreateCharacterBody.parse(req.body);

  const [character] = await db
    .insert(charactersTable)
    .values({
      playerId,
      name: body.name,
      race: body.race,
      class: body.class,
      backstory: body.backstory,
    })
    .returning();

  // AI assigns attributes + spell slots based on race/class/backstory
  try {
    const spellcastingClasses = ["wizard","sorcerer","warlock","druid","cleric","bard","paladin","ranger","shaman","witch","necromancer","summoner","mage","arcanist"];
    const isSpellcaster = spellcastingClasses.some((c) => body.class.toLowerCase().includes(c));

    const attrPrompt = `Assign D&D ability scores for this character. Return ONLY valid JSON, no extra text.
Character: ${body.name}, a ${body.race} ${body.class}.${body.backstory ? `\nBackstory: ${body.backstory}` : ""}

Rules:
- STR, DEX, CON, INT, WIS, CHA — each between 6 and 18
- Total must equal exactly 72
- Match the class archetype (e.g. Wizard: high INT, Fighter: high STR/CON, Rogue: high DEX)
- Add natural variation — not all stats equal
${isSpellcaster ? `- Include spellSlots: {"total":N,"used":0,"spellLevel":1} where N is 2–4 for a level 1 caster` : `- Set spellSlots to null (non-spellcasting class)`}

Respond with exactly:
{"attributes":{"str":N,"dex":N,"con":N,"int":N,"wis":N,"cha":N},"spellSlots":${isSpellcaster ? '{"total":N,"used":0,"spellLevel":1}' : "null"}}`;

    const attrResponse = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: attrPrompt }],
      max_tokens: 120,
      response_format: { type: "json_object" },
    });

    const raw = attrResponse.choices[0].message.content ?? "{}";
    const parsed = JSON.parse(raw);
    const attrs = parsed.attributes ?? null;
    const slots = parsed.spellSlots ?? null;

    if (attrs) {
      const [updated] = await db
        .update(charactersTable)
        .set({ attributes: attrs, spellSlots: slots })
        .where(eq(charactersTable.id, character.id))
        .returning();
      res.status(201).json(updated);
      return;
    }
  } catch {
    // Fall through — return character without attributes
  }

  res.status(201).json(character);
});

// ─── Admin Routes ────────────────────────────────────────────────────────────

router.get("/admin/users", async (req, res) => {
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

  const users = await db
    .select({
      id: playersTable.id,
      username: playersTable.username,
      role: playersTable.role,
      createdAt: playersTable.createdAt,
    })
    .from(playersTable);

  res.json(users);
});

router.delete("/admin/delete-user", async (req, res) => {
  const { adminId, targetUserId } = req.body as { adminId?: number; targetUserId?: number };

  if (!adminId || !targetUserId) {
    res.status(400).json({ error: "adminId and targetUserId required" });
    return;
  }

  if (adminId === targetUserId) {
    res.status(400).json({ error: "Cannot delete yourself" });
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

  const [deleted] = await db
    .delete(playersTable)
    .where(eq(playersTable.id, targetUserId))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ success: true, message: `User '${deleted.username}' deleted`, userId: deleted.id });
});

router.get("/admin/characters", async (req, res) => {
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

  const characters = await db
    .select({
      id: charactersTable.id,
      name: charactersTable.name,
      race: charactersTable.race,
      class: charactersTable.class,
      playerId: charactersTable.playerId,
      level: charactersTable.level,
      hp: charactersTable.hp,
      maxHp: charactersTable.maxHp,
      xp: charactersTable.xp,
      isDead: charactersTable.isDead,
      createdAt: charactersTable.createdAt,
    })
    .from(charactersTable);

  res.json(characters);
});

router.delete("/admin/delete-character", async (req, res) => {
  const { adminId, characterId } = req.body as { adminId?: number; characterId?: number };

  if (!adminId || !characterId) {
    res.status(400).json({ error: "adminId and characterId required" });
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

  const [deleted] = await db
    .delete(charactersTable)
    .where(eq(charactersTable.id, characterId))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Character not found" });
    return;
  }

  res.json({ success: true, message: `Character '${deleted.name}' deleted`, characterId: deleted.id });
});

export default router;
