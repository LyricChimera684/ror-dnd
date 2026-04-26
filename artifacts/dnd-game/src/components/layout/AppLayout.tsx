import { useState } from "react";
import { Link, useLocation } from "wouter";
import { auth } from "@/lib/auth";
import { LogOut, Scroll, Swords, Home, Menu, X, ScrollText } from "lucide-react";
import { useClerk } from "@clerk/react";

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
      <header className="border-b border-border/50 bg-black/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link
            href="/dashboard"
            className="text-xl sm:text-2xl font-display font-bold text-primary text-glow flex items-center gap-2 hover:brightness-125 transition-all shrink-0"
          >
            <Swords className="w-6 h-6 sm:w-7 sm:h-7" />
            <span className="hidden xs:inline">Realms of Replit</span>
            <span className="xs:hidden">RoR</span>
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
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-sans text-muted-foreground italic leading-none">Logged in as</div>
              <div className="font-display text-sm font-bold text-foreground">{user.username}</div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-muted-foreground hover:text-secondary transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 text-muted-foreground hover:text-primary transition-colors"
              onClick={() => setMobileMenuOpen((o) => !o)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border/50 bg-black/80 px-4 py-3 flex flex-col gap-3">
            <Link
              href="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="font-display tracking-widest text-sm text-muted-foreground hover:text-primary flex items-center gap-2 py-1"
            >
              <Home className="w-4 h-4" /> Hub
            </Link>
            <Link
              href="/campaigns"
              onClick={() => setMobileMenuOpen(false)}
              className="font-display tracking-widest text-sm text-muted-foreground hover:text-primary flex items-center gap-2 py-1"
            >
              <Scroll className="w-4 h-4" /> Campaigns
            </Link>
            <Link
              href="/notices"
              onClick={() => setMobileMenuOpen(false)}
              className="font-display tracking-widest text-sm text-muted-foreground hover:text-primary flex items-center gap-2 py-1"
            >
              <ScrollText className="w-4 h-4" /> Notice Board
            </Link>
            <div className="pt-1 border-t border-border/30 text-xs text-muted-foreground font-sans italic">
              Playing as {user.username}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto p-3 sm:p-5 lg:p-8 relative">
        {children}
      </main>
    </div>
  );
}
