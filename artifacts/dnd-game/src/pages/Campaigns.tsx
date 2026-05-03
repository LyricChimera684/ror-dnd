import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useGetCampaigns, useJoinCampaign, useGetPlayerCharacters } from "@workspace/api-client-react";
import { auth } from "@/lib/auth";
import { sound } from "@/lib/sound";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Map, Users, Key, Search, Globe, Clock, Trash2, Loader2, Sword, Shield, Lock } from "lucide-react";

function getCampaignAge(createdAt: string | Date): string {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffMins < 60) return `${diffMins}m old`;
  if (diffHours < 24) return `${diffHours}h old`;
  if (diffDays < 7) return `${diffDays}d old`;
  return `${diffWeeks}w old`;
}

type CharClass = "Barbarian" | "Bard" | "Cleric" | "Druid" | "Fighter" | "Monk" | "Paladin" | "Ranger" | "Rogue" | "Sorcerer" | "Warlock" | "Wizard" | string;

function classIcon(cls: CharClass): string {
  const icons: Record<string, string> = {
    Barbarian: "⚔️", Bard: "🎵", Cleric: "✝️", Druid: "🌿",
    Fighter: "🛡️", Monk: "👊", Paladin: "⚜️", Ranger: "🏹",
    Rogue: "🗡️", Sorcerer: "✨", Warlock: "🌑", Wizard: "📚",
  };
  return icons[cls] ?? "⚔️";
}

// ─── Custom Character Picker ──────────────────────────────────────────────────
interface CharPickerProps {
  characters: Array<{ id: number; name: string; race: string; class: string; level: number; hp: number; maxHp: number; isDead: boolean }>;
  selected: number | "";
  onSelect: (id: number) => void;
  lockedChars?: Record<number, { name: string; canSwap: boolean }>;
}

function CharacterPicker({ characters, selected, onSelect, lockedChars = {} }: CharPickerProps) {
  if (characters.length === 0) {
    return (
      <div className="text-center text-secondary font-sans py-4">
        You have no characters. Create one first!
      </div>
    );
  }

  return (
    <div className="grid gap-2 max-h-72 overflow-y-auto pr-1">
      {characters.map((c) => {
        const isSelected = selected === c.id;
        const hpPct = Math.max(0, Math.min(100, (c.hp / c.maxHp) * 100));
        const hpColor = hpPct > 60 ? "from-green-800 to-green-500" : hpPct > 30 ? "from-yellow-800 to-yellow-500" : "from-red-900 to-red-500";

        return (
          <motion.button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            whileTap={{ scale: 0.995 }}
            className={`w-full flex items-center gap-3 px-4 py-3 border text-left transition-all duration-200 ${
              isSelected
                ? "border-primary bg-primary/10 shadow-[0_0_12px_rgba(212,175,55,0.15)]"
                : "border-border/40 bg-foreground/[0.04] hover:border-primary/40 hover:bg-foreground/[0.07]"
            } ${c.isDead ? "opacity-50" : ""}`}
          >
            <div className={`w-10 h-10 shrink-0 flex items-center justify-center text-xl border ${isSelected ? "border-primary/60 bg-primary/10" : "border-border/30 bg-foreground/[0.06]"}`}>
              {c.isDead ? "💀" : classIcon(c.class)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display text-foreground truncate">{c.name}</span>
                {c.isDead && <span className="text-xs text-red-400 font-display shrink-0">Fallen</span>}
              </div>
              <div className="text-xs text-muted-foreground font-sans">{c.race} {c.class}</div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex-1 h-1 bg-foreground/10 rounded-full overflow-hidden">
                  <div className={`h-full bg-gradient-to-r ${hpColor} transition-all`} style={{ width: `${hpPct}%` }} />
                </div>
                <span className="text-xs text-muted-foreground shrink-0">❤ {c.hp}/{c.maxHp}</span>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <div className={`inline-flex px-1.5 py-0.5 border text-xs font-display tracking-widest ${isSelected ? "border-primary/50 text-primary bg-primary/10" : "border-border/30 text-muted-foreground"}`}>
                LVL {c.level}
              </div>
              {isSelected && (
                <div className="mt-1">
                  <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center mx-auto">
                    <span className="text-background text-xs">✓</span>
                  </div>
                </div>
              )}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

export default function Campaigns() {
  const user = auth.getUser();
  const [, setLocation] = useLocation();
  const [inviteCode, setInviteCode] = useState("");
  const [selectedCharId, setSelectedCharId] = useState<number | "">("");
  const [joinError, setJoinError] = useState("");
  const [joiningId, setJoiningId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [lockedCampaigns, setLockedCampaigns] = useState<Record<number, { characterName: string; canSwap: boolean }>>({});

  const { data: campaigns, isLoading, refetch } = useGetCampaigns({ playerId: user?.id }, {
    query: { enabled: !!user?.id }
  });

  const { data: characters } = useGetPlayerCharacters(user?.id || 0, {
    query: { enabled: !!user?.id }
  });

  // Fetch lock status for each campaign
  useEffect(() => {
    if (!user?.id || !campaigns?.length) return;
    const apiBase = import.meta.env.VITE_API_URL || "";
    Promise.all(
      campaigns.map(async (camp) => {
        try {
          const resp = await fetch(`${apiBase}/api/campaigns/${camp.id}/member-stats?playerId=${user.id}`);
          if (!resp.ok) return [camp.id, null] as const;
          const data = await resp.json();
          return [camp.id, { characterName: data.characterName, canSwap: data.canSwap }] as const;
        } catch {
          return [camp.id, null] as const;
        }
      })
    ).then((results) => {
      const map: Record<number, { characterName: string; canSwap: boolean }> = {};
      for (const [id, info] of results) {
        if (info) map[id] = info;
      }
      setLockedCampaigns(map);
    });
  }, [campaigns, user?.id]);

  const { mutate: join } = useJoinCampaign({
    mutation: {
      onSuccess: (session: any) => {
        if (session.characterLocked) {
          setJoinError("Your adventurer is bound to this campaign. Reach a safe haven to swap.");
          setJoiningId(null);
          // Still enter the campaign with the locked character
          auth.setSession({
            sessionId: session.id,
            campaignId: session.campaignId,
            characterId: session.characterId,
          });
          setTimeout(() => setLocation(`/game/${session.id}`), 1500);
          return;
        }
        auth.setSession({
          sessionId: session.id,
          campaignId: session.campaignId,
          characterId: Number(selectedCharId)
        });
        setLocation(`/game/${session.id}`);
      },
      onError: (err: any) => {
        setJoinError(err.message || "Failed to join campaign.");
        setJoiningId(null);
      }
    }
  });

  const handleJoin = (campaignId: number, code?: string) => {
    if (!selectedCharId) {
      setJoinError("Choose your adventurer first!");
      return;
    }
    if (!user) return;

    setJoinError("");
    setJoiningId(campaignId);
    join({
      campaignId,
      data: {
        playerId: user.id,
        characterId: Number(selectedCharId),
        ...(code ? { inviteCode: code } : {})
      }
    });
  };

  const handleDeleteCampaign = async (campaignId: number) => {
    if (!user) return;
    setDeletingId(campaignId);
    try {
      await fetch(
        `${import.meta.env.VITE_API_URL || ""}/api/campaigns/${campaignId}?requesterId=${user.id}`,
        { method: "DELETE" }
      );
      refetch();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 bg-card/50 p-4 sm:p-6 border border-border/50 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.15)]">
          <div>
            <h1 className="text-3xl sm:text-4xl mb-2">Campaign Boards</h1>
            <p className="font-sans text-muted-foreground italic text-sm sm:text-base">Find a party, or gather your own.</p>
          </div>
          <Button size="lg" className="w-full md:w-auto" onClick={() => { sound.click(); setLocation("/campaign/new"); }}>
            <Map className="mr-2" /> Start a Campaign
          </Button>
        </div>

        {/* Character Selection Panel */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-foreground/[0.05] border border-primary/20 rounded-2xl p-5 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
            <div className="flex items-center gap-2 mb-4">
              <Sword className="w-4 h-4 text-primary" />
              <h3 className="font-display text-lg text-primary tracking-wide">Choose Your Adventurer</h3>
            </div>
            <CharacterPicker
              characters={(characters ?? []) as any}
              selected={selectedCharId}
              onSelect={(id) => { setSelectedCharId(id); setJoinError(""); }}
            />
            {!selectedCharId && characters && characters.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground font-sans text-center italic">
                Select an adventurer to enter a campaign
              </p>
            )}
            {joinError && (
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 text-secondary text-sm text-center font-sans italic bg-secondary/10 border border-secondary/20 px-4 py-2"
                >
                  {joinError}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-48 bg-card animate-pulse border-ornate opacity-50" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {campaigns?.map((camp, i) => {
              const isOwner = camp.creatorId === user?.id;
              const lockInfo = lockedCampaigns[camp.id];

              return (
                <motion.div
                  key={camp.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-card border border-border/50 rounded-2xl p-4 sm:p-6 flex flex-col hover:border-primary/30 hover:shadow-[0_0_30px_rgba(212,175,55,0.1)] transition-all duration-500"
                >
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h3 className="text-2xl sm:text-3xl text-primary min-w-0 break-words">{camp.title}</h3>
                    <div className="flex items-center gap-1.5">
                      {lockInfo && (
                        <div className="flex items-center gap-1 px-2 py-0.5 border border-primary/20 bg-primary/5 text-xs font-display text-primary/70 rounded-full">
                          {lockInfo.canSwap ? (
                            <><Shield className="w-3 h-3 text-green-400" /> <span className="text-green-400">Swap available</span></>
                          ) : (
                            <><Lock className="w-3 h-3" /> {lockInfo.characterName}</>
                          )}
                        </div>
                      )}
                      {camp.isPublic ?
                        <Globe className="text-muted-foreground w-5 h-5" title="Public" /> :
                        <Key className="text-secondary w-5 h-5" title="Private" />
                      }
                    </div>
                  </div>

                  <p className="font-sans text-muted-foreground italic mb-4 flex-1">
                    "{camp.description}"
                  </p>

                  <div className="space-y-2 mb-6 font-sans border-t border-border/30 pt-4">
                    <div className="flex items-center gap-2">
                      <Map className="w-4 h-4 text-muted-foreground" />
                      <span>Setting: <span className="text-foreground">{camp.setting}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span>Creator: <span className="text-foreground">{(camp as any).creatorUsername || "Unknown"}</span></span>
                    </div>
                    {camp.createdAt && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-foreground">{getCampaignAge(camp.createdAt)}</span>
                      </div>
                    )}
                    {!camp.isPublic && camp.inviteCode && isOwner && (
                      <div className="text-sm text-primary/80 bg-primary/10 px-2 py-1 inline-block border border-primary/20 rounded-full">
                        Code: {camp.inviteCode}
                      </div>
                    )}
                  </div>

                  <div className="mt-auto space-y-2">
                    {!camp.isPublic && camp.creatorId !== user?.id ? (
                      <div className="flex gap-2 min-w-0">
                        <Input
                          placeholder="Invite Code"
                          id={`code-${camp.id}`}
                          className="h-12 rounded-full flex-1 min-w-0"
                        />
                        <Button
                          className="shrink-0"
                          onClick={() => {
                            const code = (document.getElementById(`code-${camp.id}`) as HTMLInputElement)?.value;
                            handleJoin(camp.id, code);
                          }}
                          disabled={joiningId === camp.id}
                        >
                          {joiningId === camp.id ? "..." : "Join"}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        className="w-full rounded-full"
                        onClick={() => handleJoin(camp.id)}
                        disabled={joiningId === camp.id || !selectedCharId}
                      >
                        {joiningId === camp.id ? "Entering Realm..." : "Enter Campaign"}
                      </Button>
                    )}

                    {isOwner && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full rounded-full text-red-400 hover:text-red-300 hover:bg-red-950/30 justify-center gap-2"
                        onClick={() => handleDeleteCampaign(camp.id)}
                        disabled={deletingId === camp.id}
                      >
                        {deletingId === camp.id ? (
                          <><Loader2 className="w-3 h-3 animate-spin" /> Deleting...</>
                        ) : (
                          <><Trash2 className="w-3 h-3" /> Delete Campaign</>
                        )}
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {campaigns?.length === 0 && (
              <div className="col-span-full text-center py-20 bg-foreground/[0.04] border border-border/50">
                <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-2xl mb-2">No Campaigns Found</h3>
                <p className="font-sans text-muted-foreground">The realms are quiet. Perhaps too quiet.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
