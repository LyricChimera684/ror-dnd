import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useCreateCharacter, useValidateCharacter } from "@workspace/api-client-react";
import { auth } from "@/lib/auth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { CheckCircle, XCircle, Loader2, Wand2, Shield, Sparkles, Trash2 } from "lucide-react";

type ValidationState = {
  status: "idle" | "validating" | "valid" | "invalid";
  message: string;
  suggestion?: string;
};

type CreatedCharacter = {
  id: number;
  name: string;
  race: string;
  class: string;
  attributes?: Record<string, number> | null;
  spellSlots?: { total: number; used: number; spellLevel: number } | null;
};

const ATTR_META = [
  { key: "str", label: "STR", full: "Strength",      color: "from-red-800 to-red-500" },
  { key: "dex", label: "DEX", full: "Dexterity",     color: "from-green-800 to-green-500" },
  { key: "con", label: "CON", full: "Constitution",  color: "from-orange-800 to-orange-500" },
  { key: "int", label: "INT", full: "Intelligence",  color: "from-blue-800 to-blue-500" },
  { key: "wis", label: "WIS", full: "Wisdom",        color: "from-purple-800 to-purple-500" },
  { key: "cha", label: "CHA", full: "Charisma",      color: "from-pink-800 to-pink-500" },
];

function modifier(score: number) {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function StatReveal({ character, onContinue }: { character: CreatedCharacter; onContinue: () => void }) {
  const attrs = character.attributes;
  const slots = character.spellSlots;
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    const user = auth.getUser();
    if (!user) return;
    setDeleting(true);
    await fetch(`${import.meta.env.VITE_API_URL || ""}/api/players/${user.id}/characters/${character.id}`, { method: "DELETE" });
    setDeleting(false);
    onContinue();
  };

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto px-2">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card/90 backdrop-blur-md border-ornate p-6 sm:p-8 shadow-2xl"
        >
          <div className="text-center mb-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.15 }}
              className="w-16 h-16 mx-auto rounded-full border-2 border-primary bg-primary/10 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(212,175,55,0.3)]"
            >
              <Shield className="w-8 h-8 text-primary" />
            </motion.div>
            <h1 className="text-3xl sm:text-4xl text-primary mb-1">{character.name}</h1>
            <p className="text-primary/70 italic font-sans text-sm">{character.race} · {character.class}</p>
            <p className="text-muted-foreground font-sans text-sm mt-2">
              The Dungeon Master has consulted the fates and assigned your destiny.
            </p>
          </div>

          {attrs ? (
            <div className="space-y-3 mb-6">
              <h2 className="font-sans font-semibold text-xs tracking-widest uppercase text-primary/60 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" /> Ability Scores
              </h2>
              {ATTR_META.map(({ key, label, full, color }, i) => {
                const score = attrs[key] ?? 10;
                const pct = ((score - 1) / 19) * 100;
                const mod = modifier(score);
                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.08 }}
                  >
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-sans font-semibold uppercase tracking-wider text-xs text-muted-foreground w-8 shrink-0">{label}</span>
                      <span className="font-sans text-xs text-muted-foreground/70 flex-1">{full}</span>
                      <span className="font-display text-foreground text-sm w-6 text-right tabular-nums">{score}</span>
                      <span className={`font-sans font-semibold text-xs w-8 text-right tabular-nums ${mod.startsWith("+") ? "text-green-400" : "text-red-400"}`}>{mod}</span>
                    </div>
                    <div className="h-2 bg-foreground/10 border border-border/20 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full bg-gradient-to-r ${color}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: 0.2 + i * 0.08 }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-muted-foreground text-sm italic py-4 mb-4">
              Stats are being assigned — check the Advanced tab once you enter a campaign.
            </div>
          )}

          {slots && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="mb-6 p-4 bg-blue-950/30 border border-blue-800/40 rounded-lg"
            >
              <h3 className="font-sans font-semibold text-xs tracking-widest uppercase text-blue-400/70 mb-3">
                Spell Slots · Level {slots.spellLevel}
              </h3>
              <div className="flex gap-2 items-center">
                {Array.from({ length: slots.total }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.75 + i * 0.1, type: "spring" }}
                    className="w-8 h-8 rounded-full border-2 border-blue-500 bg-blue-950/60 flex items-center justify-center text-blue-300 text-sm font-display"
                  >
                    ✦
                  </motion.div>
                ))}
                <span className="text-xs text-muted-foreground font-sans ml-1">{slots.total} slots available</span>
              </div>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="space-y-3"
          >
            <Button onClick={onContinue} className="w-full text-base py-3">
              Enter the Realm
            </Button>
            <Button
              type="button"
              variant="danger"
              className="w-full"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deleting...</> : <><Trash2 className="w-4 h-4 mr-2" /> Delete This Character</>}
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </AppLayout>
  );
}

export default function CharacterCreate() {
  const user = auth.getUser();
  const [, setLocation] = useLocation();

  const [name, setName] = useState("");
  const [race, setRace] = useState("");
  const [charClass, setCharClass] = useState("");
  const [backstory, setBackstory] = useState("");
  const [error, setError] = useState("");
  const [validation, setValidation] = useState<ValidationState>({ status: "idle", message: "" });
  const [createdCharacter, setCreatedCharacter] = useState<CreatedCharacter | null>(null);

  const { mutate: validateChar, isPending: isValidating } = useValidateCharacter({
    mutation: {
      onSuccess: (data) => {
        if (data.valid) {
          setValidation({ status: "valid", message: data.message, suggestion: data.suggestion ?? undefined });
        } else {
          setValidation({ status: "invalid", message: data.message, suggestion: data.suggestion ?? undefined });
        }
      },
      onError: () => {
        setValidation({ status: "invalid", message: "Could not validate character. Try again.", suggestion: undefined });
      }
    }
  });

  const { mutate: createChar, isPending: isCreating } = useCreateCharacter({
    mutation: {
      onSuccess: (data: any) => {
        setCreatedCharacter({
          id: data.id,
          name: data.name,
          race: data.race,
          class: data.class,
          attributes: data.attributes ?? null,
          spellSlots: data.spellSlots ?? null,
        });
      },
      onError: (err: any) => setError(err.message || "Failed to forge character.")
    }
  });

  const handleValidate = () => {
    if (!name.trim() || !race.trim() || !charClass.trim()) {
      setError("Name, race, and class are required before validation.");
      return;
    }
    setError("");
    setValidation({ status: "validating", message: "" });
    validateChar({
      playerId: user?.id ?? 0,
      data: { name, race, class: charClass, backstory }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !race.trim() || !charClass.trim()) {
      setError("Name, race, and class are required.");
      return;
    }
    if (validation.status === "invalid") {
      setError("Please fix the validation issues before creating your character.");
      return;
    }
    if (!user) return;
    setError("");
    createChar({ playerId: user.id, data: { name, race, class: charClass, backstory } });
  };

  const handleFieldChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setter(e.target.value);
    if (validation.status !== "idle") setValidation({ status: "idle", message: "" });
  };

  if (createdCharacter) {
    return <StatReveal character={createdCharacter} onContinue={() => setLocation("/dashboard")} />;
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card/90 backdrop-blur-md border-ornate p-6 sm:p-8 shadow-2xl"
        >
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-3xl sm:text-4xl text-primary mb-2">Forge a Hero</h1>
            <p className="font-sans text-muted-foreground italic text-sm sm:text-base">
              Any creature, any calling. The realm accepts all who are brave enough.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block font-display text-base sm:text-lg mb-1.5">Character Name</label>
              <Input
                value={name}
                onChange={handleFieldChange(setName)}
                placeholder="e.g. Grumbak the Stubborn"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-display text-base sm:text-lg mb-1.5">
                  Race / Origin
                  <span className="block text-xs text-muted-foreground font-sans font-normal mt-0.5">Anything goes — elf, cat, alien, robot...</span>
                </label>
                <Input
                  value={race}
                  onChange={handleFieldChange(setRace)}
                  placeholder="e.g. Dwarf, Sentient Cactus, Space Cat..."
                />
              </div>

              <div>
                <label className="block font-display text-base sm:text-lg mb-1.5">
                  Class / Calling
                  <span className="block text-xs text-muted-foreground font-sans font-normal mt-0.5">Standard or creative — the DM decides</span>
                </label>
                <Input
                  value={charClass}
                  onChange={handleFieldChange(setCharClass)}
                  placeholder="e.g. Wizard, Barista, Chaos Intern..."
                />
              </div>
            </div>

            <div>
              <label className="block font-display text-base sm:text-lg mb-1.5">Tale of Origins (Optional)</label>
              <Textarea
                value={backstory}
                onChange={handleFieldChange(setBackstory)}
                rows={3}
                placeholder="Where did you come from? What drives you?"
              />
            </div>

            <div className="text-sm text-muted-foreground/80 font-sans rounded border border-border/30 bg-foreground/[0.04] px-4 py-3">
              Your character's ability scores will be chosen by the AI based on your concept, so you can focus on the story instead of min-maxing.
            </div>

            <div className="pt-1">
              <Button
                type="button"
                variant="outline"
                className="w-full border-primary/40 hover:border-primary"
                onClick={handleValidate}
                disabled={isValidating || !name || !race || !charClass}
              >
                {isValidating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> The DM is judging your character...</>
                ) : (
                  <><Wand2 className="w-4 h-4 mr-2" /> Validate Character with AI</>
                )}
              </Button>

              <AnimatePresence>
                {validation.status === "valid" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 p-4 bg-green-950/40 border border-green-700/50 rounded flex gap-3"
                  >
                    <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-green-300 font-display text-sm">Character Approved!</div>
                      <p className="text-green-200/80 font-sans text-sm mt-1">{validation.message}</p>
                    </div>
                  </motion.div>
                )}
                {validation.status === "invalid" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 p-4 bg-red-950/40 border border-red-700/50 rounded flex gap-3"
                  >
                    <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-red-300 font-display text-sm">Pick Another Character</div>
                      <p className="text-red-200/80 font-sans text-sm mt-1">{validation.message}</p>
                      {validation.suggestion && (
                        <p className="text-primary/80 font-sans text-xs mt-2 italic">Suggestion: {validation.suggestion}</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {error && (
              <div className="text-secondary font-sans italic text-center p-3 bg-secondary/10 border border-secondary/30 rounded text-sm">
                {error}
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setLocation("/dashboard")}>
                Abandon Quest
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={isCreating || validation.status === "invalid"}
              >
                {isCreating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Consulting the fates...</>
                ) : (
                  "Manifest Hero"
                )}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AppLayout>
  );
}
