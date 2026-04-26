import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useGetPlayerCharacters, useGetAchievements } from "@workspace/api-client-react";
import { auth } from "@/lib/auth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { Plus, Shield, ScrollText, Sparkles, Trophy, Scroll, Trash2, Loader2, ChevronDown, ChevronUp, Swords } from "lucide-react";

const ATTR_LABELS: Record<string, { short: string; color: string }> = {
  str: { short: "STR", color: "text-red-400" },
  dex: { short: "DEX", color: "text-green-400" },
  con: { short: "CON", color: "text-orange-400" },
  int: { short: "INT", color: "text-blue-400" },
  wis: { short: "WIS", color: "text-purple-400" },
  cha: { short: "CHA", color: "text-pink-400" },
};

function modifier(score: number) {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function CharacterAchievements({ characterId }: { characterId: number }) {
  const { data: achievements } = useGetAchievements(characterId, { query: { enabled: !!characterId } });
  if (!achievements?.length) return null;
  return (
    <div className="mt-3 pt-3 border-t border-border/30">
      <div className="flex items-center gap-1 mb-2">
        <Trophy className="w-3 h-3 text-primary" />
        <span className="text-xs font-display text-muted-foreground">{achievements.length} Achievement{achievements.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="flex gap-1 flex-wrap">
        {achievements.slice(0, 5).map((a) => (
          <span key={a.id} title={`${a.title}: ${a.description}`} className="text-lg cursor-help">{a.icon}</span>
        ))}
        {achievements.length > 5 && <span className="text-xs text-muted-foreground font-sans self-center">+{achievements.length - 5} more</span>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const user = auth.getUser();
  const [, setLocation] = useLocation();
  const [deletingCharId, setDeletingCharId] = useState<number | null>(null);
  const [expandedStatsId, setExpandedStatsId] = useState<number | null>(null);

  useEffect(() => {
    if (user?.role === "admin") {
      setLocation("/admin");
    }
  }, [user?.role]);

  const { data: characters, isLoading, refetch } = useGetPlayerCharacters(user?.id || 0, {
    query: { enabled: !!user?.id }
  });

  if (!user) return null;

  const handleDeleteCharacter = async (charId: number) => {
    setDeletingCharId(charId);
    try {
      await fetch(`${import.meta.env.VITE_API_URL || ""}/api/players/${user.id}/characters/${charId}`, {
        method: "DELETE",
      });
      refetch();
    } finally {
      setDeletingCharId(null);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-12">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <h1 className="text-4xl md:text-5xl">Welcome, {user.username}</h1>
          <p className="text-xl font-sans text-muted-foreground italic max-w-2xl mx-auto">
            The tavern is warm, but the roads outside are dark and full of terrors. Gather your strength.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-4">
            <Button onClick={() => setLocation("/campaigns")} size="lg">
              <ScrollText className="mr-2" /> Browse Campaigns
            </Button>
            <Button variant="outline" size="lg" onClick={() => setLocation("/character/new")}>
              <Plus className="mr-2" /> New Character
            </Button>
            <Button variant="ghost" size="lg" onClick={() => setLocation("/notices")}>
              <Scroll className="mr-2" /> Notice Board
            </Button>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-8 border-b border-border/50 pb-4">
            <h2 className="text-3xl flex items-center gap-3">
              <Shield className="text-primary" /> Your Characters
            </h2>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-64 bg-card animate-pulse border-ornate opacity-50" />
              ))}
            </div>
          ) : !characters?.length ? (
            <div className="text-center py-20 bg-card/30 border border-border/30 rounded-lg">
              <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-2xl mb-2">No Heroes Yet</h3>
              <p className="text-muted-foreground font-sans mb-6">You must forge a champion before entering the campaigns.</p>
              <Button onClick={() => setLocation("/character/new")}>Create Character</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {characters.map((char, i) => (
                <motion.div
                  key={char.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-card border-ornate p-6 relative group overflow-hidden"
                >
                  <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative z-10">
                    {char.isDead && (
                      <div className="absolute top-0 right-0 text-xs font-display text-red-400 bg-red-950/60 border border-red-800/40 px-2 py-0.5 rounded-bl">
                        💀 Fallen
                      </div>
                    )}
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-2xl text-primary">{char.name}</h3>
                      <span className="font-display font-bold text-2xl opacity-50 text-muted-foreground">Lvl {char.level}</span>
                    </div>
                    <div className="space-y-2 font-sans text-lg mb-4">
                      <div className="flex justify-between border-b border-border/30 pb-1">
                        <span className="text-muted-foreground">Race</span>
                        <span>{char.race}</span>
                      </div>
                      <div className="flex justify-between border-b border-border/30 pb-1">
                        <span className="text-muted-foreground">Class</span>
                        <span>{char.class}</span>
                      </div>
                      <div className="flex justify-between border-b border-border/30 pb-1">
                        <span className="text-muted-foreground">HP</span>
                        <span className="text-secondary font-bold">{char.hp} / {char.maxHp}</span>
                      </div>
                      <div className="flex justify-between pb-1">
                        <span className="text-muted-foreground">XP</span>
                        <span className="text-primary">{char.xp}</span>
                      </div>
                    </div>
                    {/* Ability Scores toggle */}
                    {(char as any).attributes && (
                      <div className="mt-3">
                        <button
                          onClick={() => setExpandedStatsId(expandedStatsId === char.id ? null : char.id)}
                          className="w-full flex items-center justify-between text-xs font-display text-muted-foreground hover:text-primary transition-colors py-1 border-t border-border/30 pt-2"
                        >
                          <span className="flex items-center gap-1.5"><Swords className="w-3 h-3" /> Ability Scores</span>
                          {expandedStatsId === char.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        {expandedStatsId === char.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="grid grid-cols-3 gap-2 mt-2"
                          >
                            {Object.entries(ATTR_LABELS).map(([key, { short, color }]) => {
                              const score = (char as any).attributes?.[key] ?? "—";
                              const mod = typeof score === "number" ? modifier(score) : null;
                              return (
                                <div key={key} className="bg-black/30 border border-border/20 rounded p-2 text-center">
                                  <div className={`font-display text-xs ${color} mb-0.5`}>{short}</div>
                                  <div className="font-display text-lg text-foreground leading-none">{score}</div>
                                  {mod && <div className={`font-sans text-xs mt-0.5 ${mod.startsWith("+") ? "text-green-400" : "text-red-400"}`}>{mod}</div>}
                                </div>
                              );
                            })}
                          </motion.div>
                        )}
                      </div>
                    )}
                    <CharacterAchievements characterId={char.id} />
                    <div className="mt-4 pt-3 border-t border-border/20">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-red-400 hover:text-red-300 hover:bg-red-950/30 justify-center gap-2"
                        onClick={() => handleDeleteCharacter(char.id)}
                        disabled={deletingCharId === char.id}
                      >
                        {deletingCharId === char.id ? (
                          <><Loader2 className="w-3 h-3 animate-spin" /> Deleting...</>
                        ) : (
                          <><Trash2 className="w-3 h-3" /> Delete</>
                        )}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.section>
      </div>
    </AppLayout>
  );
}
