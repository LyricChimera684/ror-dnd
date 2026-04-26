import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGetSessionHistory,
  usePerformAction,
  useGetPlayerCharacters,
  useGetCampaignDiscussion,
  usePostDiscussionMessage,
  useGetInventory,
  useAddInventoryItem,
  useRemoveInventoryItem,
  useGetCampaignParty,
  useGetSessionNpcs,
  useGetSessionJournal,
  useGetSessionMap,
  useGetCombatState,
  useUpdateCombatState,
  useGetAchievements,
  useGetCampaign,
} from "@workspace/api-client-react";
import { auth } from "@/lib/auth";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  Send, Heart, Star, Sword, Dices, ChevronLeft, MessageSquare,
  BookOpen, Menu, X, Users, MapPin, UserCheck, Package, Trophy,
  Shield, Plus, Trash2, Swords, ScrollText, Skull
} from "lucide-react";

// ─── Dice Roller ─────────────────────────────────────────────────────────────
function rollDice(notation: string) {
  const match = notation.match(/^(\d+)d(\d+)$/i);
  if (!match) return { total: 0, rolls: [], sides: 20, count: 1 };
  const count = parseInt(match[1]);
  const sides = parseInt(match[2]);
  const rolls: number[] = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
  return { total: rolls.reduce((a, b) => a + b, 0), rolls, sides, count };
}

function DiceButton({ notation, onRoll }: { notation: string; onRoll: (r: string) => void }) {
  const [rolled, setRolled] = useState<null | ReturnType<typeof rollDice>>(null);
  const [animating, setAnimating] = useState(false);
  const handle = () => {
    setAnimating(true);
    setTimeout(() => { setRolled(rollDice(notation)); setAnimating(false); }, 600);
  };
  const confirm = () => {
    if (!rolled) return;
    const detail = rolled.count > 1 ? ` (${rolled.rolls.join(" + ")})` : "";
    onRoll(`🎲 Rolled ${notation} → **${rolled.total}**${detail}`);
  };
  return (
    <div className="flex flex-col items-center gap-2 my-3">
      <div className="text-sm font-display text-primary/80 tracking-widest uppercase">The DM asks you to roll {notation}</div>
      {!rolled ? (
        <Button onClick={handle} className="gap-2 bg-primary/20 border border-primary hover:bg-primary/40 text-primary font-display text-lg px-6 py-3" disabled={animating}>
          <Dices className={`w-6 h-6 ${animating ? "animate-spin" : ""}`} />
          {animating ? "Rolling..." : `Roll ${notation}`}
        </Button>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="text-4xl font-display text-primary drop-shadow-[0_0_10px_rgba(212,175,55,0.6)]">{rolled.total}</div>
          {rolled.count > 1 && <div className="text-xs text-muted-foreground">({rolled.rolls.join(" + ")})</div>}
          <Button onClick={confirm} size="sm" className="gap-2"><Send className="w-4 h-4" /> Send to DM</Button>
        </div>
      )}
    </div>
  );
}

// ─── Achievement Toast ────────────────────────────────────────────────────────
function AchievementToast({ achievements, onDismiss }: { achievements: Array<{ title: string; description: string; icon: string }>; onDismiss: () => void }) {
  useEffect(() => { const t = setTimeout(onDismiss, 5000); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -40, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed top-4 right-4 z-50 space-y-2"
      >
        {achievements.map((a, i) => (
          <div key={i} className="bg-card border-2 border-primary/60 rounded-xl p-4 shadow-[0_0_20px_rgba(212,175,55,0.3)] flex items-center gap-3 min-w-[280px]">
            <span className="text-3xl">{a.icon}</span>
            <div>
              <div className="font-display text-primary text-sm tracking-wide">Achievement Unlocked!</div>
              <div className="font-display text-foreground">{a.title}</div>
              <div className="text-xs text-muted-foreground font-sans">{a.description}</div>
            </div>
          </div>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Death Screen ─────────────────────────────────────────────────────────────
function DeathScreen({ characterName, onRestart }: { characterName: string; onRestart: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 flex flex-col items-center justify-center bg-[#0a0507] p-8 text-center space-y-6"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", delay: 0.3 }}
      >
        <Skull className="w-24 h-24 text-red-800/60 mx-auto" />
      </motion.div>
      <div>
        <h2 className="text-5xl font-display text-red-700 mb-2">You Have Fallen</h2>
        <p className="text-muted-foreground font-sans text-lg italic max-w-md">
          {characterName} has breathed their last breath. The realm mourns... or perhaps celebrates.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button variant="danger" onClick={onRestart} className="gap-2">
          <ScrollText className="w-4 h-4" /> New Character
        </Button>
        <Button variant="outline" onClick={onRestart} className="gap-2">
          <Shield className="w-4 h-4" /> Return to Tavern
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Combat Tracker ───────────────────────────────────────────────────────────
function CombatTracker({ sessionId, characterName, hp, maxHp }: { sessionId: number; characterName: string; hp: number; maxHp: number }) {
  const { data: combat, refetch } = useGetCombatState(sessionId, { query: { refetchInterval: 3000 } });
  const { mutate: updateCombat } = useUpdateCombatState({ mutation: { onSuccess: () => refetch() } });

  if (!combat?.active) return null;

  const endCombat = () => {
    updateCombat({ sessionId, data: { active: false, round: 1, combatants: [] } });
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="bg-red-950/40 border-b border-red-800/50 px-4 py-3"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Swords className="w-4 h-4 text-red-400" />
          <span className="font-display text-red-400 text-sm tracking-wide uppercase">Combat — Round {combat.round}</span>
        </div>
        <button onClick={endCombat} className="text-xs text-muted-foreground hover:text-foreground">End Combat</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {(combat.combatants as Array<{ name: string; hp: number; maxHp: number; initiative: number; isPlayer: boolean }>).map((c, i) => (
          <div key={i} className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs border ${c.isPlayer ? "border-blue-500/40 bg-blue-950/30 text-blue-300" : "border-red-500/40 bg-red-950/30 text-red-300"}`}>
            <span className="font-display">{c.name}</span>
            <span className="text-muted-foreground">❤ {c.hp}/{c.maxHp}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Party Tab ────────────────────────────────────────────────────────────────
function PartyTab({ campaignId, currentSessionId }: { campaignId: number; currentSessionId: number }) {
  const { data: members, isLoading } = useGetCampaignParty(campaignId, { query: { refetchInterval: 10000 } });
  if (isLoading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading party...</div>;
  return (
    <div className="p-4 space-y-3 overflow-y-auto">
      <h3 className="font-display text-primary/80 text-sm tracking-widest uppercase flex items-center gap-2">
        <Users className="w-4 h-4" /> Active Adventurers
      </h3>
      {members?.length === 0 && (
        <div className="text-center py-10 text-muted-foreground text-sm">No other adventurers in this campaign yet.</div>
      )}
      {members?.map((m) => (
        <div key={m.sessionId} className={`bg-card border rounded-lg p-3 ${m.sessionId === currentSessionId ? "border-primary/40" : "border-border/30"}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="font-display text-foreground">{m.characterName}</span>
            {m.isDead && <span className="text-xs text-red-400 font-display">💀 Fallen</span>}
            {m.sessionId === currentSessionId && <span className="text-xs text-primary font-display">YOU</span>}
          </div>
          <div className="text-xs text-muted-foreground font-sans">
            {m.username} · Lvl {m.level} {m.race} {m.class}
          </div>
          <div className="mt-2">
            <div className="h-1.5 bg-black/60 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-red-900 to-red-500" style={{ width: `${Math.max(0, (m.hp / m.maxHp) * 100)}%` }} />
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">❤ {m.hp}/{m.maxHp}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Journal Tab ──────────────────────────────────────────────────────────────
function JournalTab({ sessionId }: { sessionId: number }) {
  const { data: entries, isLoading } = useGetSessionJournal(sessionId, { query: { refetchInterval: 15000 } });
  return (
    <div className="p-4 space-y-4 overflow-y-auto">
      <h3 className="font-display text-primary/80 text-sm tracking-widest uppercase flex items-center gap-2">
        <BookOpen className="w-4 h-4" /> Campaign Chronicle
      </h3>
      {isLoading && <div className="text-muted-foreground animate-pulse text-sm">Loading chronicle...</div>}
      {!isLoading && entries?.length === 0 && (
        <div className="text-center py-10 text-muted-foreground text-sm italic">
          The chronicle is empty. Adventure more to fill these pages.
        </div>
      )}
      {entries?.map((entry, i) => (
        <div key={entry.id} className="bg-[#1c1a15] border border-[#3a3020] rounded-lg p-4">
          <div className="text-xs text-amber-700/60 font-display mb-2 uppercase tracking-wide">Entry {i + 1} · {new Date(entry.createdAt).toLocaleDateString()}</div>
          <p className="text-[#e8d5a3] font-sans text-sm leading-relaxed italic">{entry.summary}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Map Tab ──────────────────────────────────────────────────────────────────
function MapTab({ sessionId }: { sessionId: number }) {
  const { data: mapData, isLoading } = useGetSessionMap(sessionId, { query: { refetchInterval: 10000 } });
  const locations = (mapData?.locations as string[]) ?? [];
  return (
    <div className="p-4 space-y-4 overflow-y-auto">
      <h3 className="font-display text-primary/80 text-sm tracking-widest uppercase flex items-center gap-2">
        <MapPin className="w-4 h-4" /> World Map
      </h3>
      {isLoading && <div className="text-muted-foreground animate-pulse text-sm">Charting the realm...</div>}
      {!isLoading && locations.length === 0 && (
        <div className="text-center py-10 text-muted-foreground text-sm italic">
          No locations discovered yet. Venture forth!
        </div>
      )}
      {mapData?.currentLocation && (
        <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          <span className="font-display text-primary text-sm">Current: {mapData.currentLocation}</span>
        </div>
      )}
      <div className="space-y-2">
        {locations.map((loc, i) => (
          <div key={i} className={`flex items-center gap-2 p-2 rounded border text-sm font-sans ${loc === mapData?.currentLocation ? "border-primary/40 bg-primary/10 text-primary" : "border-border/30 bg-card/50 text-muted-foreground"}`}>
            <span className="w-5 h-5 flex items-center justify-center text-xs font-display opacity-60">{i + 1}</span>
            <MapPin className="w-3 h-3 shrink-0" />
            <span>{loc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── NPCs Tab ─────────────────────────────────────────────────────────────────
function NpcsTab({ sessionId }: { sessionId: number }) {
  const { data: npcs, isLoading } = useGetSessionNpcs(sessionId, { query: { refetchInterval: 10000 } });
  const dispositionColor: Record<string, string> = {
    friendly: "text-green-400 border-green-800",
    hostile: "text-red-400 border-red-800",
    neutral: "text-yellow-400 border-yellow-800",
  };
  return (
    <div className="p-4 space-y-3 overflow-y-auto">
      <h3 className="font-display text-primary/80 text-sm tracking-widest uppercase flex items-center gap-2">
        <UserCheck className="w-4 h-4" /> Known Characters
      </h3>
      {isLoading && <div className="text-muted-foreground animate-pulse text-sm">Loading...</div>}
      {!isLoading && npcs?.length === 0 && (
        <div className="text-center py-10 text-muted-foreground text-sm italic">
          You haven't met anyone notable yet.
        </div>
      )}
      {npcs?.map((npc) => (
        <div key={npc.id} className="bg-card border border-border/30 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="font-display text-foreground">{npc.name}</span>
            <span className={`text-xs font-display px-1.5 py-0.5 border rounded ${dispositionColor[npc.disposition] ?? "text-muted-foreground border-border"}`}>
              {npc.disposition}
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-sans">{npc.description}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Discussion Tab ───────────────────────────────────────────────────────────
function DiscussionTab({ campaignId }: { campaignId: number }) {
  const user = auth.getUser();
  const [message, setMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: messages, refetch } = useGetCampaignDiscussion(campaignId, { query: { enabled: !!campaignId, refetchInterval: 4000 } });
  const { mutate: postMsg, isPending } = usePostDiscussionMessage({ mutation: { onSuccess: () => { setMessage(""); refetch(); } } });
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);
  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !user) return;
    postMsg({ campaignId, data: { playerId: user.id, username: user.username, message } });
  };
  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
        {messages?.length === 0 && (
          <div className="text-center text-muted-foreground font-sans italic text-sm py-10">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-40" /> No messages yet.
          </div>
        )}
        {messages?.map((msg) => {
          const isMe = msg.playerId === user?.id;
          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 ${isMe ? "bg-primary/20 border border-primary/30" : "bg-card border border-border"}`}>
                <div className={`text-xs font-display tracking-wide mb-1 ${isMe ? "text-primary text-right" : "text-muted-foreground"}`}>{msg.username}</div>
                <p className="font-sans text-sm leading-relaxed">{msg.message}</p>
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={handleSend} className="p-3 border-t border-border flex gap-2">
        <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Discuss with your party..." className="flex-1 text-sm" disabled={isPending} />
        <Button type="submit" size="sm" disabled={isPending || !message.trim()}><Send className="w-4 h-4" /></Button>
      </form>
    </div>
  );
}

// ─── Inventory Panel ──────────────────────────────────────────────────────────
function InventoryPanel({ characterId }: { characterId: number }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", type: "misc", quantity: "1" });
  const { data: items, refetch } = useGetInventory(characterId, { query: { enabled: !!characterId } });
  const { mutate: addItem, isPending: adding_ } = useAddInventoryItem({ mutation: { onSuccess: () => { setAdding(false); setForm({ name: "", description: "", type: "misc", quantity: "1" }); refetch(); } } });
  const { mutate: removeItem } = useRemoveInventoryItem({ mutation: { onSuccess: () => refetch() } });

  const typeIcon: Record<string, string> = { weapon: "⚔️", armor: "🛡️", potion: "🧪", quest: "📜", misc: "📦" };

  return (
    <div className="border-t border-border/30 mt-3 pt-3">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between text-sm font-display text-muted-foreground hover:text-primary transition-colors">
        <span className="flex items-center gap-2"><Package className="w-3.5 h-3.5" /> Inventory ({items?.length ?? 0})</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-1">
          {items?.length === 0 && <div className="text-xs text-muted-foreground italic text-center py-2">Empty pack</div>}
          {items?.map((item) => (
            <div key={item.id} className="flex items-center gap-1.5 text-xs group">
              <span>{typeIcon[item.type] ?? "📦"}</span>
              <span className="flex-1 text-foreground/80 truncate">{item.name}</span>
              <span className="text-muted-foreground shrink-0">x{item.quantity}</span>
              <button onClick={() => removeItem({ characterId, itemId: item.id })} className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 transition-opacity">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          {!adding ? (
            <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mt-1">
              <Plus className="w-3 h-3" /> Add item
            </button>
          ) : (
            <div className="mt-2 space-y-1">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Item name" className="h-7 text-xs" />
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full h-7 text-xs bg-background border border-border rounded px-2">
                {["weapon", "armor", "potion", "quest", "misc"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <div className="flex gap-1">
                <Input value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="Qty" className="h-7 text-xs w-16" type="number" min="1" />
                <Button size="sm" className="h-7 flex-1 text-xs" disabled={!form.name.trim() || adding_}
                  onClick={() => addItem({ characterId, data: { name: form.name, description: form.description, type: form.type, quantity: parseInt(form.quantity) || 1 } })}>
                  Add
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAdding(false)}>✕</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Achievements Panel ───────────────────────────────────────────────────────
function AchievementsPanel({ characterId }: { characterId: number }) {
  const [open, setOpen] = useState(false);
  const { data: achievements } = useGetAchievements(characterId, { query: { enabled: !!characterId } });
  return (
    <div className="border-t border-border/30 mt-3 pt-3">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between text-sm font-display text-muted-foreground hover:text-primary transition-colors">
        <span className="flex items-center gap-2"><Trophy className="w-3.5 h-3.5" /> Achievements ({achievements?.length ?? 0})</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          {achievements?.length === 0 && <div className="text-xs text-muted-foreground italic text-center py-2">No achievements yet</div>}
          {achievements?.map((a) => (
            <div key={a.id} className="flex items-center gap-2 text-xs">
              <span className="text-base">{a.icon}</span>
              <div>
                <div className="font-display text-foreground/90">{a.title}</div>
                <div className="text-muted-foreground">{a.description}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Attributes Tab ───────────────────────────────────────────────────────────
const ATTR_META: { key: string; label: string; color: string; desc: string }[] = [
  { key: "str", label: "STR", color: "bg-red-600",    desc: "Strength" },
  { key: "dex", label: "DEX", color: "bg-green-600",  desc: "Dexterity" },
  { key: "con", label: "CON", color: "bg-orange-600", desc: "Constitution" },
  { key: "int", label: "INT", color: "bg-blue-600",   desc: "Intelligence" },
  { key: "wis", label: "WIS", color: "bg-purple-600", desc: "Wisdom" },
  { key: "cha", label: "CHA", color: "bg-pink-600",   desc: "Charisma" },
];

function modifier(score: number) {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function AttributesPanel({ character }: { character: { attributes?: unknown; spellSlots?: unknown; statusEffects?: unknown } }) {
  const attrs = character.attributes as Record<string, number> | null | undefined;
  const slots = character.spellSlots as { total: number; used: number; spellLevel: number } | null | undefined;
  const effects = (character.statusEffects as string[]) ?? [];

  if (!attrs) {
    return (
      <div className="p-6 text-center text-muted-foreground text-sm italic">
        Stats are being assigned by the Dungeon Master...
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5 overflow-y-auto">
      <h3 className="font-display text-primary/80 text-sm tracking-widest uppercase flex items-center gap-2">
        <Shield className="w-4 h-4" /> Ability Scores
      </h3>

      <div className="space-y-2.5">
        {ATTR_META.map(({ key, label, color, desc }) => {
          const score = attrs[key] ?? 10;
          const pct = ((score - 1) / 19) * 100;
          return (
            <div key={key}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-display text-muted-foreground w-8">{label}</span>
                <span className="text-muted-foreground flex-1 pl-1 font-sans">{desc}</span>
                <span className="font-display text-foreground">{score}</span>
                <span className={`ml-2 w-8 text-right font-display text-xs ${modifier(score).startsWith("+") ? "text-green-400" : "text-red-400"}`}>{modifier(score)}</span>
              </div>
              <div className="h-1.5 bg-black/60 border border-border/30 rounded-full overflow-hidden">
                <div className={`h-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {slots && (
        <div className="pt-3 border-t border-border/30">
          <h4 className="font-display text-primary/70 text-xs tracking-widest uppercase mb-2">Spell Slots (Lvl {slots.spellLevel})</h4>
          <div className="flex gap-1.5 flex-wrap">
            {Array.from({ length: slots.total }).map((_, i) => (
              <div key={i} className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-display transition-colors ${i < (slots.total - slots.used) ? "border-blue-500 bg-blue-950/60 text-blue-300" : "border-border/30 bg-black/20 text-muted-foreground/30"}`}>
                {i < (slots.total - slots.used) ? "✦" : "○"}
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground mt-1 font-sans">{slots.total - slots.used} / {slots.total} remaining</div>
        </div>
      )}

      {effects.length > 0 && (
        <div className="pt-3 border-t border-border/30">
          <h4 className="font-display text-primary/70 text-xs tracking-widest uppercase mb-2">Status Effects</h4>
          <div className="flex flex-wrap gap-1.5">
            {effects.map((e) => (
              <span key={e} className="px-2 py-0.5 rounded-full text-xs font-display border border-yellow-700/50 bg-yellow-950/40 text-yellow-300">{e}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Safe Haven Banner ────────────────────────────────────────────────────────
function SafeHavenBanner({ onFlee }: { onFlee: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="shrink-0 flex items-center justify-between gap-4 px-4 py-2.5 bg-emerald-950/60 border-b border-emerald-700/40 text-sm"
    >
      <div className="flex items-center gap-2 text-emerald-300 font-sans">
        <Shield className="w-4 h-4 shrink-0" />
        <span>You're in a safe place — you may return to the Tavern to change your adventurer.</span>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={onFlee}
        className="shrink-0 text-xs text-emerald-300 hover:text-emerald-100 border border-emerald-700/40 hover:bg-emerald-900/40"
      >
        Flee to Tavern
      </Button>
    </motion.div>
  );
}

// ─── Main GameSession ─────────────────────────────────────────────────────────
type Tab = "game" | "discuss" | "party" | "journal" | "map" | "npcs" | "advanced";

interface CampaignStats {
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  isDead: boolean;
}

export default function GameSession() {
  const { sessionId } = useParams();
  const [, setLocation] = useLocation();
  const user = auth.getUser();
  const session = auth.getSession();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [actionInput, setActionInput] = useState("");
  const [tab, setTab] = useState<Tab>("game");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingDice, setPendingDice] = useState<string | null>(null);
  const [waitingForRoll, setWaitingForRoll] = useState(false);
  const [newAchievements, setNewAchievements] = useState<Array<{ title: string; description: string; icon: string }>>([]);
  const [characterDead, setCharacterDead] = useState(false);
  const [campaignStats, setCampaignStats] = useState<CampaignStats | null>(null);
  const [canSwap, setCanSwap] = useState(false);

  useEffect(() => {
    if (!user || !session || session.sessionId !== Number(sessionId)) setLocation("/dashboard");
  }, [user, session, sessionId, setLocation]);

  // Fetch campaign-specific stats on mount
  useEffect(() => {
    if (!session?.campaignId || !user?.id) return;
    const apiBase = import.meta.env.VITE_API_URL || "";
    fetch(`${apiBase}/api/campaigns/${session.campaignId}/member-stats?playerId=${user.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setCampaignStats({ hp: data.hp, maxHp: data.maxHp, level: data.level, xp: data.xp, isDead: data.isDead });
          setCanSwap(data.canSwap);
          if (data.isDead) setCharacterDead(true);
        }
      })
      .catch(() => {});
  }, [session?.campaignId, user?.id]);

  const { data: history, isLoading: historyLoading, refetch: refetchHistory } = useGetSessionHistory(
    Number(sessionId), { query: { enabled: !!sessionId, refetchInterval: 6000 } }
  );

  const { data: characters, refetch: refetchCharacters } = useGetPlayerCharacters(user?.id || 0, { query: { enabled: !!user?.id } });
  const { data: campaign } = useGetCampaign(session?.campaignId ?? 0, { query: { enabled: !!session?.campaignId } });

  const activeCharacter = characters?.find((c) => c.id === session?.characterId);

  useEffect(() => {
    if (!campaignStats && activeCharacter?.isDead) setCharacterDead(true);
  }, [activeCharacter, campaignStats]);

  const { mutate: takeAction, isPending: actionPending } = usePerformAction({
    mutation: {
      onSuccess: (data: any) => {
        setActionInput("");
        setWaitingForRoll(false);
        refetchHistory();
        refetchCharacters();
        if (data.diceRequest) { setPendingDice(data.diceRequest); setWaitingForRoll(true); }
        else { setPendingDice(null); }
        if (data.isDead) setCharacterDead(true);
        if (data.campaignStats) {
          setCampaignStats({ ...data.campaignStats, isDead: data.isDead ?? false });
        }
        setCanSwap(data.canSwap ?? false);
        if (data.newAchievements && data.newAchievements.length > 0) {
          setNewAchievements(data.newAchievements as Array<{ title: string; description: string; icon: string }>);
        }
      }
    }
  });

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [history]);

  const myCharacterId = session?.characterId;

  const handleAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionInput.trim() || actionPending || waitingForRoll) return;
    takeAction({ sessionId: Number(sessionId), data: { action: actionInput, characterId: myCharacterId } });
  };

  const handleDiceRoll = useCallback((result: string) => {
    setPendingDice(null);
    setWaitingForRoll(false);
    takeAction({ sessionId: Number(sessionId), data: { action: result, characterId: myCharacterId } });
  }, [sessionId, takeAction, myCharacterId]);

  if (!user || !session) return null;

  // Use campaign-specific stats when available, fall back to global character stats
  const displayHp = campaignStats?.hp ?? activeCharacter?.hp ?? 0;
  const displayMaxHp = campaignStats?.maxHp ?? activeCharacter?.maxHp ?? 20;
  const displayLevel = campaignStats?.level ?? activeCharacter?.level ?? 1;
  const displayXp = campaignStats?.xp ?? activeCharacter?.xp ?? 0;
  const displayIsDead = campaignStats?.isDead ?? activeCharacter?.isDead ?? false;

  const hpPct = Math.max(0, Math.min(100, (displayHp / displayMaxHp) * 100));
  const xpToNext = 100;
  const xpPct = (displayXp % xpToNext) / xpToNext * 100;

  const tabDefs: { id: Tab; icon: React.ReactNode; label: string }[] = [
    { id: "game", icon: <Sword className="w-4 h-4" />, label: "Adventure" },
    { id: "discuss", icon: <MessageSquare className="w-4 h-4" />, label: "Discuss" },
    { id: "party", icon: <Users className="w-4 h-4" />, label: "Party" },
    { id: "journal", icon: <BookOpen className="w-4 h-4" />, label: "Journal" },
    { id: "map", icon: <MapPin className="w-4 h-4" />, label: "Map" },
    { id: "npcs", icon: <UserCheck className="w-4 h-4" />, label: "NPCs" },
    { id: "advanced", icon: <Shield className="w-4 h-4" />, label: "Advanced" },
  ];

  return (
    <div className="h-screen w-full flex bg-background overflow-hidden">
      {/* Achievement Toast */}
      {newAchievements.length > 0 && (
        <AchievementToast achievements={newAchievements} onDismiss={() => setNewAchievements([])} />
      )}

      {/* Sidebar overlay (mobile) */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}
      </AnimatePresence>

      {/* CHARACTER SIDEBAR */}
      <aside className={`fixed lg:static top-0 left-0 h-full z-40 lg:z-auto w-72 sm:w-80 flex flex-col bg-card border-r border-border/50 shadow-2xl transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-4 border-b border-border/50 bg-black/40 flex items-center justify-between">
          <h2 className="text-xl text-primary">Character Sheet</h2>
          <button className="lg:hidden text-muted-foreground" onClick={() => setSidebarOpen(false)}><X className="w-5 h-5" /></button>
        </div>

        {activeCharacter ? (
          <div className="p-4 flex-1 overflow-y-auto">
            <div className="text-center mb-5">
              <div className="w-16 h-16 mx-auto border-2 border-primary rounded-full bg-black/50 flex items-center justify-center mb-3 shadow-[0_0_15px_rgba(212,175,55,0.2)]">
                {displayIsDead ? <Skull className="w-8 h-8 text-red-800/60" /> : <Sword className="w-8 h-8 text-primary/50" />}
              </div>
              <h3 className="text-xl font-display text-foreground">{activeCharacter.name}</h3>
              {displayIsDead && <div className="text-xs text-red-400 font-display mb-1">💀 Fallen</div>}
              <p className="text-primary italic text-sm">{activeCharacter.race} · {activeCharacter.class}</p>
              <span className="mt-1 inline-flex px-2 py-0.5 bg-white/5 border border-white/10 rounded font-display tracking-widest text-xs">LEVEL {displayLevel}</span>
              {((activeCharacter.statusEffects as string[]) ?? []).length > 0 && (
                <div className="flex flex-wrap justify-center gap-1 mt-2">
                  {((activeCharacter.statusEffects as string[]) ?? []).map((e) => (
                    <span key={e} className="px-1.5 py-0.5 rounded-full text-xs font-display border border-yellow-700/60 bg-yellow-950/50 text-yellow-300">{e}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1 text-muted-foreground">
                  <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-red-400" /> HP</span>
                  <span className={displayHp < displayMaxHp * 0.3 ? "text-red-400 font-bold" : ""}>{displayHp} / {displayMaxHp}</span>
                </div>
                <div className="h-2.5 bg-black/60 border border-border rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-red-900 to-red-500 transition-all duration-700" style={{ width: `${hpPct}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1 text-muted-foreground">
                  <span className="flex items-center gap-1"><Star className="w-3 h-3 text-primary" /> XP</span>
                  <span>{displayXp} XP</span>
                </div>
                <div className="h-2 bg-black/60 border border-border rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-700" style={{ width: `${xpPct}%` }} />
                </div>
                <div className="text-right text-xs text-muted-foreground/60 mt-0.5">{displayXp % xpToNext} / {xpToNext} to next</div>
              </div>
              <div className="pt-3 border-t border-border/30 grid grid-cols-2 gap-2 text-xs">
                {[["Level", displayLevel], ["Max HP", displayMaxHp]].map(([l, v]) => (
                  <div key={String(l)} className="bg-black/30 border border-border/30 rounded p-2 text-center">
                    <div className="text-muted-foreground">{l}</div>
                    <div className="text-foreground font-bold text-sm">{v}</div>
                  </div>
                ))}
              </div>
              {activeCharacter.backstory && (
                <div className="pt-3 border-t border-border/30">
                  <h4 className="font-display text-sm mb-1.5 text-primary/80">Backstory</h4>
                  <p className="text-muted-foreground italic text-xs leading-relaxed">{activeCharacter.backstory}</p>
                </div>
              )}
              <InventoryPanel characterId={activeCharacter.id} />
              <AchievementsPanel characterId={activeCharacter.id} />
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-muted-foreground text-sm animate-pulse">Loading stats...</div>
        )}

        <div className="p-3 border-t border-border/50">
          <Button variant="ghost" size="sm" className="w-full text-muted-foreground justify-start gap-2" onClick={() => setLocation("/campaigns")}>
            <ChevronLeft className="w-4 h-4" /> Flee to Tavern
          </Button>
        </div>
      </aside>

      {/* MAIN AREA */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Top bar */}
        <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 border-b border-border/50 bg-card/80 backdrop-blur-sm shrink-0 overflow-x-auto">
          <button className="lg:hidden p-1.5 text-muted-foreground hover:text-primary shrink-0" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex gap-0.5 sm:gap-1 flex-1">
            {tabDefs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded text-xs sm:text-sm font-display transition-colors whitespace-nowrap ${tab === t.id ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground"}`}>
                {t.icon}
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>
          <div className="lg:hidden text-right shrink-0">
            <div className="text-xs text-primary font-display">{activeCharacter?.name}</div>
            <div className="text-xs text-muted-foreground">❤ {displayHp}/{displayMaxHp}</div>
          </div>
        </div>

        {/* Safe Haven Banner */}
        <AnimatePresence>
          {canSwap && (
            <SafeHavenBanner onFlee={() => setLocation("/campaigns")} />
          )}
        </AnimatePresence>

        {/* Combat tracker (shown above content when active) */}
        {session && activeCharacter && (
          <CombatTracker sessionId={Number(sessionId)} characterName={activeCharacter.name} hp={displayHp} maxHp={displayMaxHp} />
        )}

        {/* Tab content */}
        {tab === "discuss" && <div className="flex-1 min-h-0"><DiscussionTab campaignId={session.campaignId} /></div>}
        {tab === "party" && <div className="flex-1 overflow-y-auto"><PartyTab campaignId={session.campaignId} currentSessionId={Number(sessionId)} /></div>}
        {tab === "journal" && <div className="flex-1 overflow-y-auto"><JournalTab sessionId={Number(sessionId)} /></div>}
        {tab === "map" && <div className="flex-1 overflow-y-auto"><MapTab sessionId={Number(sessionId)} /></div>}
        {tab === "npcs" && <div className="flex-1 overflow-y-auto"><NpcsTab sessionId={Number(sessionId)} /></div>}
        {tab === "advanced" && (
          <div className="flex-1 overflow-y-auto">
            {activeCharacter
              ? <AttributesPanel character={activeCharacter} />
              : <div className="p-6 text-center text-muted-foreground animate-pulse text-sm">Loading...</div>
            }
          </div>
        )}

        {tab === "game" && (
          <>
            {characterDead ? (
              <DeathScreen characterName={activeCharacter?.name ?? "Your character"} onRestart={() => setLocation("/dashboard")} />
            ) : (
              <>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-7 space-y-5 min-h-0 bg-[#0f0d0b]">
                  {historyLoading ? (
                    <div className="flex justify-center py-12"><Sword className="w-8 h-8 text-primary animate-spin" /></div>
                  ) : (
                    <AnimatePresence initial={false}>
                      {history?.map((msg, i) => {
                        const isDM = msg.role === "assistant";
                        const isDmEvent = msg.content.startsWith("[DM EVENT]");
                        // Parse "**CharacterName**: action text" prefix from user messages
                        const charPrefixMatch = !isDM ? msg.content.match(/^\*\*(.+?)\*\*:\s*(.*)$/s) : null;
                        const charName = charPrefixMatch ? charPrefixMatch[1] : (activeCharacter?.name ?? "You");
                        const displayContent = charPrefixMatch ? charPrefixMatch[2] : msg.content;
                        const isMyChar = charPrefixMatch ? charName === activeCharacter?.name : true;
                        return (
                          <motion.div key={msg.id ?? i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                            className={`flex ${isDM ? "justify-start" : "justify-end"}`}>
                            <div className={`max-w-[90%] sm:max-w-[80%] lg:max-w-[75%] rounded-lg px-4 sm:px-5 py-3 sm:py-4 shadow-lg ${
                              isDmEvent
                                ? "bg-purple-950/50 border border-purple-700/50 text-purple-200"
                                : isDM
                                  ? "bg-[#1c1a15] border border-[#3a3020] text-[#e8d5a3]"
                                  : isMyChar
                                    ? "bg-[#1a1f2e] border border-[#2a3a5a] text-foreground"
                                    : "bg-[#1a2a1a] border border-[#2a5a2a] text-foreground"
                            }`}>
                              <div className={`text-xs font-display tracking-widest mb-2 uppercase ${isDmEvent ? "text-purple-400/80" : isDM ? "text-amber-600/80" : isMyChar ? "text-blue-400/80 text-right" : "text-green-400/80 text-right"}`}>
                                {isDmEvent ? "⚡ World Event" : isDM ? "Dungeon Master" : charName}
                              </div>
                              <div className="font-sans text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
                                {isDmEvent ? msg.content.replace("[DM EVENT] ", "") : displayContent}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                      {pendingDice && waitingForRoll && (
                        <motion.div key="dice" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex justify-center">
                          <div className="bg-[#1c1710] border border-primary/40 rounded-xl px-6 py-4 text-center max-w-xs w-full">
                            <DiceButton notation={pendingDice} onRoll={handleDiceRoll} />
                          </div>
                        </motion.div>
                      )}
                      {actionPending && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                          <div className="bg-[#1c1a15] border border-[#3a3020] rounded-lg px-5 py-4">
                            <div className="flex items-center gap-1.5 text-amber-600/80">
                              {[0, 0.15, 0.3].map((d) => <span key={d} className="w-2 h-2 bg-amber-600/60 rounded-full animate-bounce" style={{ animationDelay: `${d}s` }} />)}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}
                  <div className="h-2" />
                </div>

                <div className="shrink-0 p-3 sm:p-4 bg-card border-t border-border shadow-[0_-5px_15px_rgba(0,0,0,0.4)] z-10">
                  <form onSubmit={handleAction} className="max-w-3xl mx-auto flex gap-2 items-center">
                    <Input
                      value={actionInput}
                      onChange={(e) => setActionInput(e.target.value)}
                      placeholder={waitingForRoll ? "Roll the dice above first..." : "What do you do?"}
                      className="flex-1 py-2.5 sm:py-3 text-base border-primary/40 focus-visible:ring-primary"
                      disabled={actionPending || waitingForRoll}
                    />
                    <Button type="submit" size="sm" disabled={actionPending || !actionInput.trim() || waitingForRoll} className="shrink-0 h-10 w-10 p-0 bg-primary hover:bg-primary/80">
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                  <p className="text-center mt-1.5 text-xs font-sans italic text-muted-foreground/60">
                    {waitingForRoll ? "The DM awaits your dice roll above." : "Describe your actions. The Dungeon Master determines fate."}
                  </p>
                </div>

              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
