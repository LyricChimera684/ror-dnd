import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useCreateCampaign } from "@workspace/api-client-react";
import { auth } from "@/lib/auth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  Wand2,
  Pencil,
  Castle,
  Skull,
  TreePine,
  Building2,
  Flame,
  Mountain,
  Anchor,
  ChevronLeft,
  Check,
} from "lucide-react";

// ─── Preset Definitions ──────────────────────────────────────────────────────

interface CampaignPreset {
  id: string;
  name: string;
  badge: string;
  icon: React.ReactNode;
  accentColor: string;
  setting: string;
  description: string;
  tags: string[];
}

const PRESETS: CampaignPreset[] = [
  {
    id: "strahd",
    name: "Curse of Strahd",
    badge: "Gothic Horror",
    icon: <Castle className="w-7 h-7" />,
    accentColor:
      "from-red-950/80 to-purple-950/80 border-red-900/60 hover:border-red-700/80",
    setting:
      "The mist-shrouded land of Barovia, a gothic realm trapped under the iron rule of the vampire lord Strahd von Zarovich.",
    description:
      "Strangers drawn through arcane mists find themselves imprisoned in the dark domain of Barovia. To escape, they must uncover ancient relics and face the immortal Count Strahd himself in his looming Castle Ravenloft — all while the very land conspires against them.",
    tags: ["Horror", "Exploration", "Boss Fight"],
  },
  {
    id: "phandelver",
    name: "Lost Mines of Phandelver",
    badge: "Classic Adventure",
    icon: <Mountain className="w-7 h-7" />,
    accentColor:
      "from-stone-950/80 to-amber-950/80 border-stone-700/60 hover:border-amber-600/80",
    setting:
      "The frontier town of Phandalin and the surrounding wilderness of the Sword Coast, where the legendary Wave Echo Cave holds untold power.",
    description:
      "A simple supply escort job takes a dark turn when goblins ambush the party. The trail leads to the lost mine of Phandelver, a legendary forge of spells coveted by the mysterious Spider — and every faction in the region will stop at nothing to claim its magic.",
    tags: ["Beginner Friendly", "Mystery", "Combat"],
  },
  {
    id: "toa",
    name: "Tomb of Annihilation",
    badge: "Deadly Exploration",
    icon: <Skull className="w-7 h-7" />,
    accentColor:
      "from-green-950/80 to-yellow-950/80 border-green-900/60 hover:border-green-700/80",
    setting:
      "The savage jungle peninsula of Chult — a land of dinosaurs, undead, and ancient yuan-ti temples festering beneath a relentless tropical sun.",
    description:
      "A death curse is spreading across the world: the raised dead rot away and resurrection magic fails. The source is a soul-devouring artifact deep in the Chultan jungle. The party must brave prehistoric wilds, cannibal tribes, and the deathtrap dungeon of Acererak himself — the Tomb of the Nine Gods.",
    tags: ["Deadly", "Jungle", "Dungeon Crawl"],
  },
  {
    id: "dragonheist",
    name: "Waterdeep: Dragon Heist",
    badge: "Urban Intrigue",
    icon: <Building2 className="w-7 h-7" />,
    accentColor:
      "from-blue-950/80 to-indigo-950/80 border-blue-900/60 hover:border-blue-700/80",
    setting:
      "The sprawling City of Splendors — Waterdeep — a cosmopolitan metropolis teeming with guilds, noble houses, secret societies, and half a million souls above and below the cobblestones.",
    description:
      "Half a million gold dragons stolen from the city's vault. Four ruthless factions racing to recover them. The party stumbles into the city's deadliest treasure hunt, navigating political webs, sewer monsters, and lavish noble galas before the true villain makes their final move.",
    tags: ["City", "Heist", "Roleplay Heavy"],
  },
  {
    id: "abyss",
    name: "Out of the Abyss",
    badge: "Underdark Survival",
    icon: <TreePine className="w-7 h-7" />,
    accentColor:
      "from-violet-950/80 to-slate-950/80 border-violet-900/60 hover:border-violet-700/80",
    setting:
      "The Underdark — a vast subterranean world of alien beauty and nightmare predators where demon lords have been unleashed and madness seeps into every cavern.",
    description:
      "Captured by drow slavers and dragged into the sunless depths, the party must survive among a band of desperate prisoners. As demon lords tear apart the Underdark, every escape route becomes a gauntlet through fungal jungles, underground seas, and cities on the brink of annihilation.",
    tags: ["Survival", "Escape", "Grim Dark"],
  },
  {
    id: "skt",
    name: "Storm King's Thunder",
    badge: "Epic Scale",
    icon: <Mountain className="w-7 h-7" />,
    accentColor:
      "from-cyan-950/80 to-gray-950/80 border-cyan-900/60 hover:border-cyan-700/80",
    setting:
      "The Sword Coast and the great wilderness of Faerûn, now shattered by a war between the giant lords — fire, frost, stone, cloud, and storm — that threatens to raze every human settlement.",
    description:
      "The ordning — the divine hierarchy of giantkind — has been shattered. Fire giants enslave entire kingdoms for iron. Frost giants raid coastal cities. Stone giants shatter cathedrals for sport. Only by uncovering the secret of the ancient giant-human conflict can the party restore order before civilization falls.",
    tags: ["Epic", "Open World", "High Stakes"],
  },
  {
    id: "avernus",
    name: "Descent into Avernus",
    badge: "Infernal Road Trip",
    icon: <Flame className="w-7 h-7" />,
    accentColor:
      "from-orange-950/80 to-red-950/80 border-orange-900/60 hover:border-red-700/80",
    setting:
      "The holy city of Elturel and the first layer of the Nine Hells — Avernus — a scorched hellscape of warring demon armies, infernal war machines, and rivers of blood.",
    description:
      "The city of Elturel has been dragged into Avernus by a devil's bargain gone wrong. The party descends into the Nine Hells to free the city before it sinks into the River Styx forever — making dangerous deals with archdevils, riding infernal war machines, and confronting the truth behind the city's damnation.",
    tags: ["Hell", "Moral Dilemmas", "Action"],
  },
  {
    id: "sunken",
    name: "The Sunken Citadel",
    badge: "Classic Dungeon",
    icon: <Anchor className="w-7 h-7" />,
    accentColor:
      "from-teal-950/80 to-stone-950/80 border-teal-900/60 hover:border-teal-700/80",
    setting:
      "A goblin-infested fortress submerged into a ravine, built atop the ancient ruins of a dragon cult that worshipped the Gulthias Tree — a vampire-touched tree of terrible power.",
    description:
      "Locals whisper of magical fruit that heals any wound or poisons without cure. Both grow on the Gulthias Tree, deep in a sunken ruin overrun by goblins and kobolds. The party descends to find missing adventurers — and discovers the tree is only the beginning of what lurks in the dark below.",
    tags: ["Dungeon", "Starter", "Classic"],
  },
];

// ─── Mode Picker ──────────────────────────────────────────────────────────────

function ModePicker({ onSelect }: { onSelect: (mode: "preset" | "diy") => void }) {
  return (
    <motion.div
      key="mode"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-2xl mx-auto"
    >
      <div className="bg-card/90 backdrop-blur-md border-ornate p-10 shadow-2xl text-center">
        <h1 className="text-4xl text-primary mb-2">Weave a New World</h1>
        <p className="font-sans text-muted-foreground italic mb-10">
          Take on the mantle of the Dungeon Master.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onSelect("preset")}
            className="group flex flex-col items-center gap-4 p-8 bg-primary/10 border border-border hover:border-primary/60 hover:bg-primary/20 transition-all duration-300 cursor-pointer text-left"
          >
            <div className="w-16 h-16 flex items-center justify-center border border-primary/40 bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
              <Wand2 className="w-8 h-8" />
            </div>
            <div>
              <div className="font-display text-xl text-primary mb-1">Use a Preset</div>
              <div className="font-sans text-sm text-muted-foreground">
                Choose from {PRESETS.length} legendary adventures and start playing in seconds.
              </div>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onSelect("diy")}
            className="group flex flex-col items-center gap-4 p-8 bg-primary/10 border border-border hover:border-primary/60 hover:bg-primary/20 transition-all duration-300 cursor-pointer text-left"
          >
            <div className="w-16 h-16 flex items-center justify-center border border-primary/40 bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
              <Pencil className="w-8 h-8" />
            </div>
            <div>
              <div className="font-display text-xl text-primary mb-1">Build Your Own</div>
              <div className="font-sans text-sm text-muted-foreground">
                Craft your world from scratch — your story, your rules.
              </div>
            </div>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Preset Gallery ───────────────────────────────────────────────────────────

function PresetGallery({
  onSelect,
  onBack,
}: {
  onSelect: (preset: CampaignPreset) => void;
  onBack: () => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <motion.div
      key="gallery"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-5xl mx-auto"
    >
      <div className="bg-card/90 backdrop-blur-md border-ornate p-8 shadow-2xl">
        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border/50">
          <button
            onClick={onBack}
            className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 font-sans text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-3xl text-primary">Choose Your Legend</h1>
            <p className="font-sans text-muted-foreground text-sm italic mt-1">
              Select a preset — you can customise all fields before creating.
            </p>
          </div>
          <div className="w-16" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {PRESETS.map((preset) => (
            <motion.button
              key={preset.id}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onHoverStart={() => setHovered(preset.id)}
              onHoverEnd={() => setHovered(null)}
              onClick={() => onSelect(preset)}
              className={`relative flex flex-col text-left p-5 bg-gradient-to-br border transition-all duration-300 cursor-pointer group ${preset.accentColor}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="text-primary/80 group-hover:text-primary transition-colors">
                  {preset.icon}
                </div>
                <span className="font-sans text-[10px] uppercase tracking-widest text-muted-foreground border border-border/50 px-2 py-0.5">
                  {preset.badge}
                </span>
              </div>

              <div className="font-display text-base text-foreground mb-2 leading-tight">
                {preset.name}
              </div>

              <AnimatePresence mode="wait">
                {hovered === preset.id ? (
                  <motion.p
                    key="desc"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="font-sans text-xs text-muted-foreground leading-relaxed overflow-hidden"
                  >
                    {preset.setting}
                  </motion.p>
                ) : (
                  <motion.div
                    key="tags"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-wrap gap-1 mt-auto pt-2"
                  >
                    {preset.tags.map((tag) => (
                      <span
                        key={tag}
                        className="font-sans text-[10px] text-primary/70 border border-primary/20 px-1.5 py-0.5"
                      >
                        {tag}
                      </span>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Campaign Form ────────────────────────────────────────────────────────────

function CampaignForm({
  preset,
  onBack,
}: {
  preset: CampaignPreset | null;
  onBack: () => void;
}) {
  const user = auth.getUser();
  const [, setLocation] = useLocation();

  const [title, setTitle] = useState(preset?.name ?? "");
  const [description, setDescription] = useState(preset?.description ?? "");
  const [setting, setSetting] = useState(preset?.setting ?? "");
  const [isPublic, setIsPublic] = useState(true);
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");

  const { mutate: createCamp, isPending } = useCreateCampaign({
    mutation: {
      onSuccess: () => setLocation("/campaigns"),
      onError: (err: any) => setError(err.message || "Failed to weave the world."),
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !setting) {
      setError("Title, description, and setting are required to shape a world.");
      return;
    }
    if (!isPublic && !inviteCode) {
      setError("A private realm requires an invite code.");
      return;
    }
    if (!user) return;
    createCamp({
      data: {
        title,
        description,
        setting,
        isPublic,
        creatorId: user.id,
        ...(!isPublic ? { inviteCode } : {}),
      },
    });
  };

  return (
    <motion.div
      key="form"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-3xl mx-auto"
    >
      <div className="bg-card/90 backdrop-blur-md border-ornate p-8 md:p-12 shadow-2xl">
        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border/50">
          <button
            onClick={onBack}
            className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 font-sans text-sm shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex-1 text-center">
            {preset ? (
              <>
                <div className="flex items-center justify-center gap-2 text-primary/60 font-sans text-xs uppercase tracking-widest mb-1">
                  <Check className="w-3 h-3" />
                  Preset: {preset.name}
                </div>
                <h1 className="text-3xl text-primary">Customise Your World</h1>
                <p className="font-sans text-muted-foreground text-sm italic mt-1">
                  Fields are pre-filled — edit anything you like.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-4xl text-primary mb-1">Weave a New World</h1>
                <p className="font-sans text-muted-foreground italic">
                  Take on the mantle of the Dungeon Master.
                </p>
              </>
            )}
          </div>
          <div className="w-16 shrink-0" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <label className="block font-display text-xl mb-2 text-primary/90">Campaign Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The Curse of Strahd"
              className="text-xl py-4"
            />
          </div>

          <div>
            <label className="block font-display text-xl mb-2 text-primary/90">The Setting / Lore</label>
            <Input
              value={setting}
              onChange={(e) => setSetting(e.target.value)}
              placeholder="e.g. A dark gothic realm ruled by vampires"
            />
          </div>

          <div>
            <label className="block font-display text-xl mb-2 text-primary/90">Synopsis</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="What adventure awaits the brave souls who join?"
              className="w-full bg-black/40 border border-border px-4 py-3 text-lg font-sans text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          <div className="bg-black/20 p-6 border border-border/50 flex flex-col gap-6">
            <label className="flex items-center gap-4 cursor-pointer">
              <div className="relative" onClick={() => setIsPublic((v) => !v)}>
                <div
                  className={`w-14 h-8 bg-black border border-border rounded-full transition-colors ${isPublic ? "bg-primary/20 border-primary" : ""}`}
                />
                <div
                  className={`absolute top-1 left-1 w-6 h-6 bg-muted-foreground rounded-full transition-transform ${isPublic ? "transform translate-x-6 bg-primary" : ""}`}
                />
              </div>
              <div className="font-display text-lg">
                {isPublic ? "Public Tavern (Open to all)" : "Private Chambers (Requires Code)"}
              </div>
            </label>

            {!isPublic && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="pl-18"
              >
                <label className="block font-display text-sm mb-2 text-muted-foreground">
                  Secret Passphrase
                </label>
                <Input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="e.g. Mellon"
                />
              </motion.div>
            )}
          </div>

          {error && (
            <div className="text-secondary font-sans italic text-center p-4 bg-secondary/10 border border-secondary/30">
              {error}
            </div>
          )}

          <div className="pt-4 flex gap-4">
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={() => setLocation("/campaigns")}
            >
              Cancel
            </Button>
            <Button type="submit" size="lg" className="flex-2" disabled={isPending}>
              {isPending ? "Manifesting Realm..." : "Create Campaign"}
            </Button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Step = "mode" | "gallery" | "form";

export default function CampaignCreate() {
  const [step, setStep] = useState<Step>("mode");
  const [selectedPreset, setSelectedPreset] = useState<CampaignPreset | null>(null);

  const handleModeSelect = (mode: "preset" | "diy") => {
    if (mode === "preset") {
      setStep("gallery");
    } else {
      setSelectedPreset(null);
      setStep("form");
    }
  };

  const handlePresetSelect = (preset: CampaignPreset) => {
    setSelectedPreset(preset);
    setStep("form");
  };

  const handleBack = () => {
    if (step === "form" && selectedPreset) {
      setStep("gallery");
    } else {
      setStep("mode");
    }
  };

  return (
    <AppLayout>
      <AnimatePresence mode="wait">
        {step === "mode" && (
          <ModePicker key="mode" onSelect={handleModeSelect} />
        )}
        {step === "gallery" && (
          <PresetGallery key="gallery" onSelect={handlePresetSelect} onBack={handleBack} />
        )}
        {step === "form" && (
          <CampaignForm key="form" preset={selectedPreset} onBack={handleBack} />
        )}
      </AnimatePresence>
    </AppLayout>
  );
}
