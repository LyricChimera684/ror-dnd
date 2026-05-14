import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { auth } from "@/lib/auth";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Swords } from "lucide-react";
import { useSignUp } from "@clerk/react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_BASE = import.meta.env.VITE_API_URL || "";

export default function Signup() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { signUp } = useSignUp();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError("Both fields are required.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create account.");
      auth.setUser({ id: data.id, username: data.username, role: String(data.role ?? "").toLowerCase() });
      setLocation("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      await signUp?.sso({
        strategy: "oauth_google",
        redirectUrl: `${BASE}/dashboard`,
        redirectCallbackUrl: `${BASE}/sign-up/sso-callback`,
      });
    } catch (err: any) {
      setError("Google sign-up failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-x-hidden py-4 px-4">
      <div
        className="absolute inset-0 z-0 opacity-40 bg-cover bg-center"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/hero-dungeon.png)` }}
      />
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-background via-background/80 to-transparent" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="text-center mb-3 sm:mb-8">
          <Swords className="w-10 h-10 sm:w-16 sm:h-16 mx-auto text-primary mb-1 sm:mb-4 drop-shadow-[0_0_15px_rgba(212,175,55,0.5)]" />
          <h1 className="text-3xl sm:text-5xl md:text-6xl text-primary text-glow mb-0.5 sm:mb-2">Realms of Replit</h1>
          <p className="text-sm sm:text-xl font-sans italic text-muted-foreground">Begin Your Legend</p>
        </div>

        <div className="bg-card/80 backdrop-blur-xl border-ornate p-4 sm:p-8 shadow-2xl space-y-3 sm:space-y-5">
          <h2 className="text-lg sm:text-2xl text-center">Forge Your Account</h2>

          <button
            type="button"
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 bg-foreground/[0.04] hover:bg-foreground/[0.08] border border-border text-foreground font-display tracking-wide py-3 px-4 rounded-xl transition-colors duration-200"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border/40" />
            <span className="text-sm font-sans text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border/40" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-4">
            <div>
              <label className="block font-sans font-semibold text-sm text-muted-foreground mb-1.5">Adventurer's Name</label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. GandalfTheGrey"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block font-sans font-semibold text-sm text-muted-foreground mb-1.5">Secret Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="min. 6 characters"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="block font-sans font-semibold text-sm text-muted-foreground mb-1.5">Confirm Password</label>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>

            {error && (
              <div className="text-secondary font-sans italic text-center p-3 bg-secondary/10 border border-secondary/30">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Forging Account..." : "Create Account"}
            </Button>
          </form>

          <p className="text-center text-sm font-sans text-muted-foreground">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => setLocation("/login")}
              className="text-primary hover:underline font-display"
            >
              Sign In
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
