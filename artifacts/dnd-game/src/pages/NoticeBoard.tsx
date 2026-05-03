import { useState } from "react";
import { motion } from "framer-motion";
import { useGetNotices, usePostNotice, getGetNoticesQueryKey } from "@workspace/api-client-react";
import { auth } from "@/lib/auth";
import { sound } from "@/lib/sound";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { ScrollText, Plus, Shield, Swords, Star } from "lucide-react";

export default function NoticeBoard() {
  const user = auth.getUser();
  const [posting, setPosting] = useState(false);
  const [form, setForm] = useState({ content: "", campaignTitle: "" });

  const { data: notices, refetch, isLoading } = useGetNotices({
    query: { queryKey: getGetNoticesQueryKey(), refetchInterval: 15000 }
  });

  const { mutate: post, isPending } = usePostNotice({
    mutation: {
      onSuccess: () => {
        setPosting(false);
        setForm({ content: "", campaignTitle: "" });
        refetch();
      }
    }
  });

  const handlePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.content.trim()) return;
    post({
      data: {
        playerId: user.id,
        username: user.username,
        content: form.content,
        campaignTitle: form.campaignTitle || undefined,
      }
    });
  };

  const noticeIcons = [ScrollText, Shield, Swords, Star];

  return (
    <AppLayout>
      <div className="space-y-8 max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl mb-3">Tavern Notice Board</h1>
          <p className="text-muted-foreground font-sans italic text-sm sm:text-base">
            Leave word for fellow adventurers. Boast of victories, warn of dangers, seek companions.
          </p>
        </motion.div>

        {user && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
            {!posting ? (
              <Button onClick={() => { sound.click(); setPosting(true); }} className="gap-2 w-full sm:w-auto">
                <Plus className="w-4 h-4" /> Pin a Notice
              </Button>
            ) : (
              <div className="bg-card border-ornate p-5 space-y-3">
                <h3 className="font-display text-primary text-lg">Write Your Notice</h3>
                <form onSubmit={handlePost} className="space-y-3">
                  <Textarea
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    placeholder="What tale do you bring to the tavern? Share your triumph, your warning, or your quest..."
                    className="h-28 text-sm"
                    maxLength={500}
                    required
                  />
                  <Input
                    value={form.campaignTitle}
                    onChange={(e) => setForm({ ...form, campaignTitle: e.target.value })}
                    placeholder="Campaign name (optional)"
                    className="text-sm"
                  />
                  <div className="flex gap-2">
                    <Button type="submit" disabled={isPending || !form.content.trim()} size="sm">
                      {isPending ? "Pinning..." : "Pin Notice"}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => { sound.click(); setPosting(false); }}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </motion.div>
        )}

        <div className="space-y-4">
          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 bg-card animate-pulse border border-border/30 rounded" />
              ))}
            </div>
          )}
          {!isLoading && notices?.length === 0 && (
            <div className="text-center py-20 text-muted-foreground italic font-sans">
              <ScrollText className="w-12 h-12 mx-auto mb-4 opacity-30" />
              The notice board is bare. Be the first to leave your mark.
            </div>
          )}
          {notices?.map((notice, i) => {
            const Icon = noticeIcons[i % noticeIcons.length];
            return (
              <motion.div
                key={notice.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="surface-parchment border rounded-lg p-4 sm:p-5 relative overflow-hidden"
              >
                <div className="absolute top-3 right-4 opacity-10">
                  <Icon className="w-16 h-16 text-primary" />
                </div>
                <div className="relative z-10">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <span className="font-display text-primary">{notice.username}</span>
                      {notice.campaignTitle && (
                        <span className="ml-2 text-xs font-sans font-semibold uppercase tracking-wide text-muted-foreground border border-border/40 px-1.5 py-0.5 rounded">
                          {notice.campaignTitle}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground/60 shrink-0">
                      {new Date(notice.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <p className="text-parchment font-sans text-sm leading-relaxed">{notice.content}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
