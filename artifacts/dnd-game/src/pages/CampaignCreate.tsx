import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useCreateCampaign } from "@workspace/api-client-react";
import { auth } from "@/lib/auth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function CampaignCreate() {
  const user = auth.getUser();
  const [, setLocation] = useLocation();
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [setting, setSetting] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");

  const { mutate: createCamp, isPending } = useCreateCampaign({
    mutation: {
      onSuccess: () => {
        setLocation("/campaigns");
      },
      onError: (err: any) => {
        setError(err.message || "Failed to weave the world.");
      }
    }
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
        ...( !isPublic ? { inviteCode } : {} )
      }
    });
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card/90 backdrop-blur-md border-ornate p-8 md:p-12 shadow-2xl"
        >
          <div className="text-center mb-10 border-b border-border/50 pb-6">
            <h1 className="text-4xl text-primary mb-2">Weave a New World</h1>
            <p className="font-sans text-muted-foreground italic">Take on the mantle of the Dungeon Master.</p>
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
                rows={4}
                placeholder="What adventure awaits the brave souls who join?"
                className="w-full bg-black/40 border border-border px-4 py-3 text-lg font-sans text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>

            <div className="bg-black/20 p-6 border border-border/50 flex flex-col gap-6">
              <label className="flex items-center gap-4 cursor-pointer">
                <div className="relative">
                  <input 
                    type="checkbox" 
                    className="sr-only" 
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                  />
                  <div className={`w-14 h-8 bg-black border border-border rounded-full transition-colors ${isPublic ? 'bg-primary/20 border-primary' : ''}`}></div>
                  <div className={`absolute top-1 left-1 w-6 h-6 bg-muted-foreground rounded-full transition-transform ${isPublic ? 'transform translate-x-6 bg-primary' : ''}`}></div>
                </div>
                <div className="font-display text-lg">
                  {isPublic ? "Public Tavern (Open to all)" : "Private Chambers (Requires Code)"}
                </div>
              </label>

              {!isPublic && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="pl-18"
                >
                  <label className="block font-display text-sm mb-2 text-muted-foreground">Secret Passphrase</label>
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
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setLocation("/campaigns")}>
                Cancel
              </Button>
              <Button type="submit" size="lg" className="flex-2" disabled={isPending}>
                {isPending ? "Manifesting Realm..." : "Create Campaign"}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AppLayout>
  );
}
