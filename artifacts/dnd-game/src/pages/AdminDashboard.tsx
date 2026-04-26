import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { auth } from "@/lib/auth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { Trash2, Shield } from "lucide-react";

type Tab = "users" | "campaigns" | "characters";

interface User {
  id: number;
  username: string;
  role: string;
  createdAt: string;
}

interface Campaign {
  id: number;
  title: string;
  creatorId: number;
  isPublic: boolean;
  createdAt: string;
}

interface Character {
  id: number;
  name: string;
  race: string;
  class: string;
  playerId: number;
  level: number;
  isDead: boolean;
}

export default function AdminDashboard() {
  const user = auth.getUser();
  const [, setLocation] = useLocation();
  const baseUrl = `/api`;
  const [tab, setTab] = useState<Tab>("users");
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Refresh the current role from the server so stale localStorage doesn't block admins
  useEffect(() => {
    if (!user) {
      setLocation("/dashboard");
      return;
    }
    const loadRole = async () => {
      try {
        const res = await fetch(`${baseUrl}/players/${user.id}`);
        if (!res.ok) return;
        const data = await res.json();
        setCurrentRole(String(data.role ?? "").toLowerCase());
      } catch {
        setCurrentRole(String(user.role ?? "").toLowerCase());
      }
    };
    loadRole();
  }, [user, setLocation]);

  const adminId = user?.id;

  useEffect(() => {
    if (user && currentRole === null) {
      setCurrentRole(String(user.role ?? "").toLowerCase());
    }
  }, [user, currentRole]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/admin/users?adminId=${adminId}`);
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
    setLoading(false);
  };

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/admin/campaigns?adminId=${adminId}`);
      if (!res.ok) throw new Error("Failed to fetch campaigns");
      const data = await res.json();
      setCampaigns(data);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
    setLoading(false);
  };

  const fetchCharacters = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/admin/characters?adminId=${adminId}`);
      if (!res.ok) throw new Error("Failed to fetch characters");
      const data = await res.json();
      setCharacters(data);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (currentRole !== "admin") return;
    if (tab === "users") fetchUsers();
    else if (tab === "campaigns") fetchCampaigns();
    else if (tab === "characters") fetchCharacters();
  }, [tab, adminId, currentRole]);

  const deleteUser = async (userId: number) => {
    if (!confirm("Are you sure? This cannot be undone.")) return;
    try {
      const res = await fetch(`${baseUrl}/admin/delete-user`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId, targetUserId: userId }),
      });
      if (!res.ok) throw new Error("Failed to delete user");
      setUsers(users.filter((u) => u.id !== userId));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deleteCampaign = async (campaignId: number) => {
    if (!confirm("Are you sure? This cannot be undone.")) return;
    try {
      const res = await fetch(`${baseUrl}/admin/delete-campaign`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId, campaignId }),
      });
      if (!res.ok) throw new Error("Failed to delete campaign");
      setCampaigns(campaigns.filter((c) => c.id !== campaignId));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deleteCharacter = async (characterId: number) => {
    if (!confirm("Are you sure? This cannot be undone.")) return;
    try {
      const res = await fetch(`${baseUrl}/admin/delete-character`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId, characterId }),
      });
      if (!res.ok) throw new Error("Failed to delete character");
      setCharacters(characters.filter((c) => c.id !== characterId));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (!user) return null;
  if (currentRole === null) {
    return (
      <AppLayout>
        <div className="text-center py-12 text-muted-foreground">Checking admin access...</div>
      </AppLayout>
    );
  }
  if (currentRole !== "admin") return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <Shield className="w-8 h-8 text-primary" />
          <h1 className="text-4xl">Admin Dashboard</h1>
        </motion.section>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border">
          {(["users", "campaigns", "characters"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 font-display text-sm transition-colors ${
                tab === t
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && <div className="bg-red-900/20 border border-red-700/30 text-red-300 p-3 rounded text-sm">{error}</div>}

        {/* Content */}
        {loading ? (
          <div className="text-center text-muted-foreground py-12">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            {tab === "users" && (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-2 font-display text-primary">ID</th>
                    <th className="px-4 py-2 font-display text-primary">Username</th>
                    <th className="px-4 py-2 font-display text-primary">Role</th>
                    <th className="px-4 py-2 font-display text-primary">Created</th>
                    <th className="px-4 py-2 font-display text-primary">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border/30 hover:bg-primary/5">
                      <td className="px-4 py-2">{u.id}</td>
                      <td className="px-4 py-2">{u.username}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded text-xs ${u.role === "admin" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-2">
                        <button onClick={() => deleteUser(u.id)} className="text-red-500 hover:text-red-400 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === "campaigns" && (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-2 font-display text-primary">ID</th>
                    <th className="px-4 py-2 font-display text-primary">Title</th>
                    <th className="px-4 py-2 font-display text-primary">Creator</th>
                    <th className="px-4 py-2 font-display text-primary">Public</th>
                    <th className="px-4 py-2 font-display text-primary">Created</th>
                    <th className="px-4 py-2 font-display text-primary">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.id} className="border-b border-border/30 hover:bg-primary/5">
                      <td className="px-4 py-2">{c.id}</td>
                      <td className="px-4 py-2">{c.title}</td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">{c.creatorId}</td>
                      <td className="px-4 py-2">{c.isPublic ? "Yes" : "No"}</td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">{new Date(c.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-2">
                        <button onClick={() => deleteCampaign(c.id)} className="text-red-500 hover:text-red-400 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === "characters" && (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-2 font-display text-primary">ID</th>
                    <th className="px-4 py-2 font-display text-primary">Name</th>
                    <th className="px-4 py-2 font-display text-primary">Race / Class</th>
                    <th className="px-4 py-2 font-display text-primary">Level</th>
                    <th className="px-4 py-2 font-display text-primary">Status</th>
                    <th className="px-4 py-2 font-display text-primary">Player ID</th>
                    <th className="px-4 py-2 font-display text-primary">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {characters.map((ch) => (
                    <tr key={ch.id} className="border-b border-border/30 hover:bg-primary/5">
                      <td className="px-4 py-2">{ch.id}</td>
                      <td className="px-4 py-2">{ch.name}</td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">{ch.race} / {ch.class}</td>
                      <td className="px-4 py-2">{ch.level}</td>
                      <td className="px-4 py-2">
                        <span className={ch.isDead ? "text-red-500" : "text-green-500"}>
                          {ch.isDead ? "Dead" : "Alive"}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">{ch.playerId}</td>
                      <td className="px-4 py-2">
                        <button onClick={() => deleteCharacter(ch.id)} className="text-red-500 hover:text-red-400 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
