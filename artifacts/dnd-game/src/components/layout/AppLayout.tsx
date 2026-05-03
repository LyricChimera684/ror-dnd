import { useState } from "react";
import { Link, useLocation } from "wouter";
import { auth } from "@/lib/auth";
import { LogOut, Scroll, Swords, Home, Menu, X, ScrollText } from "lucide-react";
import { useClerk } from "@clerk/react";
import { ThemeMenu } from "./ThemeMenu";
import { SoundToggle } from "./SoundToggle";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const user = auth.getUser();
  const { signOut } = useClerk();

  if (!user) {
    setLocation("/");
    return null;
  }

  const handleLogout = () => {
    auth.logout();
    signOut().catch(() => {});
    setLocation("/");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/50 bg-background/60 backdrop-blur-md fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link
            href="/dashboard"
            className="text-lg sm:text-2xl font-display font-bold text-primary text-glow flex items-center gap-1.5 sm:gap-2 hover:brightness-125 transition-all shrink-0 min-w-0"
          >
            <Swords className="w-5 h-5 sm:w-7 sm:h-7 shrink-0" />
            <span className="hidden sm:inline">Realms of Replit</span>
            <span className="sm:hidden">RoR</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex gap-5 flex-1 ml-6">
            <Link
              href="/dashboard"
              className="font-display tracking-widest text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
            >
              <Home className="w-4 h-4" /> Hub
            </Link>
            <Link
              href="/campaigns"
              className="font-display tracking-widest text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
            >
              <Scroll className="w-4 h-4" /> Campaigns
            </Link>
            <Link
              href="/notices"
              className="font-display tracking-widest text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
            >
              <ScrollText className="w-4 h-4" /> Notice Board
            </Link>
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            <div className="text-right hidden lg:block">
              <div className="text-xs font-sans text-muted-foreground italic leading-none">Logged in as</div>
              <div className="font-display text-sm font-bold text-foreground">{user.username}</div>
            </div>
            <div className="hidden sm:flex items-center gap-1">
              <SoundToggle />
              <ThemeMenu />
            </div>
            <button
              onClick={handleLogout}
              className="hidden sm:inline-flex p-2 text-muted-foreground hover:text-secondary transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 text-muted-foreground hover:text-primary transition-colors"
              onClick={() => setMobileMenuOpen((o) => !o)}
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border/50 bg-black/90 backdrop-blur-md px-4 py-4 flex flex-col gap-1 shadow-xl">
            <Link
              href="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="font-display tracking-widest text-sm text-muted-foreground hover:text-primary hover:bg-white/5 active:bg-white/10 flex items-center gap-3 py-3 px-3 rounded-lg transition-colors"
            >
              <Home className="w-5 h-5" /> Hub
            </Link>
            <Link
              href="/campaigns"
              onClick={() => setMobileMenuOpen(false)}
              className="font-display tracking-widest text-sm text-muted-foreground hover:text-primary hover:bg-white/5 active:bg-white/10 flex items-center gap-3 py-3 px-3 rounded-lg transition-colors"
            >
              <Scroll className="w-5 h-5" /> Campaigns
            </Link>
            <Link
              href="/notices"
              onClick={() => setMobileMenuOpen(false)}
              className="font-display tracking-widest text-sm text-muted-foreground hover:text-primary hover:bg-white/5 active:bg-white/10 flex items-center gap-3 py-3 px-3 rounded-lg transition-colors"
            >
              <ScrollText className="w-5 h-5" /> Notice Board
            </Link>
            <div className="mt-2 pt-3 border-t border-border/30 flex items-center gap-2 sm:hidden">
              <SoundToggle />
              <ThemeMenu />
              <button
                onClick={handleLogout}
                className="ml-auto flex items-center gap-2 px-3 py-2 text-muted-foreground hover:text-secondary text-sm font-display tracking-widest"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
            <div className="pt-2 text-xs text-muted-foreground font-sans italic px-3">
              Playing as <span className="text-primary">{user.username}</span>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto p-3 sm:p-5 lg:p-8 relative pt-16 sm:pt-20">
        {children}
      </main>
    </div>
  );
}
