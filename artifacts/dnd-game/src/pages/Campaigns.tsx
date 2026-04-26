import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useGetCampaigns, useJoinCampaign, useGetPlayerCharacters } from "@workspace/api-client-react";
import { auth } from "@/lib/auth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Map, Users, Key, Search, Globe, Clock } from "lucide-react";

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

export default function Campaigns() {
  const user = auth.getUser();
  const [, setLocation] = useLocation();
  const [inviteCode, setInviteCode] = useState("");
  const [selectedCharId, setSelectedCharId] = useState<number | "">("");
  const [joinError, setJoinError] = useState("");
  const [joiningId, setJoiningId] = useState<number | null>(null);

  const { data: campaigns, isLoading } = useGetCampaigns({ playerId: user?.id }, {
    query: { enabled: !!user?.id }
  });

  const { data: characters } = useGetPlayerCharacters(user?.id || 0, {
    query: { enabled: !!user?.id }
  });

  const { mutate: join } = useJoinCampaign({
    mutation: {
      onSuccess: (session) => {
        // Always store the player's OWN selected character (not the session's original creator's)
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
      setJoinError("Select a character first!");
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

  const handleJoinPrivate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode) return;
    // We don't know the campaign ID from just the code in this UI, 
    // usually we'd have a specific endpoint to join by code.
    // Assuming backend handles campaignId=0 or we parse it if API required it.
    // The current OpenAPI requires campaignId in path: /campaigns/{campaignId}/join.
    // This means the user must click a specific campaign OR the backend needs a generic join route.
    // Given the constraints, we will show an error if they try to use the generic input without a known ID.
    setJoinError("To join a private campaign, it must appear in your list or you need the exact ID (Limitation of current API).");
  };

  return (
    <AppLayout>
      <div className="space-y-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card/50 p-6 border-b border-border">
          <div>
            <h1 className="text-4xl mb-2">Campaign Boards</h1>
            <p className="font-sans text-muted-foreground italic">Find a party, or gather your own.</p>
          </div>
          <Button size="lg" onClick={() => setLocation("/campaign/new")}>
            <Map className="mr-2" /> Start a Campaign
          </Button>
        </div>

        {/* Character Selection for Joining */}
        <div className="bg-primary/10 border border-primary/30 p-6 rounded-lg max-w-2xl mx-auto backdrop-blur-sm">
          <h3 className="font-display text-xl mb-4 text-primary text-center">Active Adventurer</h3>
          {characters?.length === 0 ? (
            <div className="text-center text-secondary font-sans">You have no characters. Create one first!</div>
          ) : (
            <select 
              value={selectedCharId}
              onChange={(e) => setSelectedCharId(e.target.value ? Number(e.target.value) : "")}
              className="w-full bg-background border border-primary/50 px-4 py-3 text-lg font-sans text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">-- Choose who will journey forth --</option>
              {characters?.map(c => (
                <option key={c.id} value={c.id} className="bg-card">
                  {c.name} (Lvl {c.level} {c.class})
                </option>
              ))}
            </select>
          )}
          {joinError && <div className="mt-4 text-secondary text-center font-sans italic">{joinError}</div>}
        </div>

        {/* Private Join via Code */}
        {/*
        <form onSubmit={handleJoinPrivate} className="flex gap-4 max-w-md mx-auto">
          <Input 
            value={inviteCode} 
            onChange={(e) => setInviteCode(e.target.value)} 
            placeholder="Secret Invite Code..." 
            className="flex-1"
          />
          <Button variant="outline" type="submit"><Key className="w-5 h-5" /></Button>
        </form>
        */}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-48 bg-card animate-pulse border-ornate opacity-50" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {campaigns?.map((camp, i) => (
              <motion.div
                key={camp.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-card border-ornate p-6 flex flex-col hover:shadow-[0_0_30px_rgba(212,175,55,0.1)] transition-shadow duration-500"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-3xl text-primary">{camp.title}</h3>
                  {camp.isPublic ? 
                    <Globe className="text-muted-foreground w-6 h-6" title="Public" /> : 
                    <Key className="text-secondary w-6 h-6" title="Private" />
                  }
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
                  {!camp.isPublic && camp.inviteCode && camp.creatorId === user?.id && (
                     <div className="text-sm text-primary/80 bg-primary/10 px-2 py-1 inline-block border border-primary/20">
                       Code: {camp.inviteCode}
                     </div>
                  )}
                </div>

                <div className="mt-auto">
                  {!camp.isPublic && camp.creatorId !== user?.id ? (
                     <div className="flex gap-2">
                       <Input 
                          placeholder="Invite Code" 
                          id={`code-${camp.id}`}
                          className="h-12"
                        />
                       <Button 
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
                      className="w-full" 
                      onClick={() => handleJoin(camp.id)}
                      disabled={joiningId === camp.id || !selectedCharId}
                    >
                      {joiningId === camp.id ? "Entering Realm..." : "Enter Campaign"}
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
            
            {campaigns?.length === 0 && (
              <div className="col-span-full text-center py-20 bg-black/20 border border-border/50">
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
