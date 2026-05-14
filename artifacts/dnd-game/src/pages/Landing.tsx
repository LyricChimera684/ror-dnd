import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Swords, ChevronDown, Dices, Users, BookOpen, MapPin } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ThemeMenu } from "@/components/layout/ThemeMenu";
import { sound } from "@/lib/sound";
import { auth } from "@/lib/auth";

const features = [
  {
    icon: <Swords className="w-7 h-7 text-primary" />,
    title: "AI Dungeon Master",
    desc: "An intelligent, unforgiving DM narrates every action, enforces consequences, and adapts to your choices in real time.",
  },
  {
    icon: <Dices className="w-7 h-7 text-primary" />,
    title: "Real Dice, Real Stakes",
    desc: "Server-rolled dice you can't cheat. Every roll is fair — and final.",
  },
  {
    icon: <Users className="w-7 h-7 text-primary" />,
    title: "Multiplayer Campaigns",
    desc: "Join friends in shared campaigns. Act together, argue over loot, and watch the story shift around your whole party.",
  },
  {
    icon: <BookOpen className="w-7 h-7 text-primary" />,
    title: "Living World",
    desc: "A growing journal, world map, and NPC roster tracks every event, location, and character you encounter.",
  },
  {
    icon: <MapPin className="w-7 h-7 text-primary" />,
    title: "Infinite Campaigns",
    desc: "Build your own world or let the DM improvise one. Each campaign is a fresh story in an ever-expanding universe.",
  },
];

export default function Landing() {
  const [, setLocation] = useLocation();
  const featuresRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const user = auth.getUser();
    if (user) setLocation("/dashboard");
  }, [setLocation]);

  const scrollToFeatures = () => {
    featuresRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const enter = () => {
    sound.click();
    setLocation("/login");
  };

  return (
    <div className="bg-background text-foreground overflow-x-hidden">
      {/* ─── Floating top-right controls ───────────────────────────── */}
      <div className="fixed top-3 right-3 z-50">
        <ThemeMenu align="right" />
      </div>

      {/* ─── Hero ──────────────────────────────────────────────────── */}
      <section className="relative h-screen min-h-[600px] flex flex-col items-center justify-center overflow-hidden">
        {/* Background */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-35"
          style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/hero-dungeon.png)` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/40 to-background" />

        {/* Animated particles (subtle) */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-primary/60"
            style={{ left: `${15 + i * 15}%`, top: `${20 + (i % 3) * 20}%` }}
            animate={{ y: [-10, 10, -10], opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 3 + i, repeat: Infinity, delay: i * 0.5 }}
          />
        ))}

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="relative z-10 text-center px-6 flex flex-col items-center gap-6"
        >
          <motion.div
            animate={{ filter: ["drop-shadow(0 0 8px rgba(212,175,55,0.3))", "drop-shadow(0 0 20px rgba(212,175,55,0.7))", "drop-shadow(0 0 8px rgba(212,175,55,0.3))"] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <Swords className="w-16 h-16 text-primary mx-auto" />
          </motion.div>

          <div>
            <h1 className="text-5xl sm:text-7xl md:text-8xl text-primary leading-none mb-3">
              Realms of Replit
            </h1>
            <p className="text-lg sm:text-2xl font-sans italic text-muted-foreground max-w-xl mx-auto">
              A multiplayer AI-powered text adventure where every choice matters.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <Button
              onClick={enter}
              size="lg"
              className="text-base sm:text-lg px-10 shadow-[0_0_30px_rgba(212,175,55,0.25)] hover:shadow-[0_0_40px_rgba(212,175,55,0.45)] transition-shadow"
            >
              <Swords className="w-5 h-5 mr-2" />
              Enter the Realm
            </Button>
            <button
              onClick={() => { sound.click(); setLocation("/signup"); }}
              className="font-display tracking-wide text-base sm:text-lg text-muted-foreground hover:text-primary transition-colors px-6 py-3"
            >
              Create Account
            </button>
          </div>

          <p className="text-xs font-sans text-muted-foreground/50 mt-1">
            Free to play · No downloads required
          </p>
        </motion.div>

        {/* Scroll indicator */}
        <motion.button
          onClick={scrollToFeatures}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-muted-foreground/50 hover:text-primary transition-colors z-10"
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          aria-label="Scroll down"
        >
          <span className="text-xs font-sans tracking-widest uppercase">Discover</span>
          <ChevronDown className="w-5 h-5" />
        </motion.button>
      </section>

      {/* ─── Features ──────────────────────────────────────────────── */}
      <section ref={featuresRef} className="relative px-6 py-24 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-5xl text-primary mb-4">What Awaits You</h2>
          <p className="text-muted-foreground font-sans max-w-2xl mx-auto text-base sm:text-lg leading-relaxed">
            Realms of Replit is a living, breathing RPG world driven by an AI Dungeon Master that never repeats itself.
            Your decisions shape the story — and the story pushes back.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="bg-card/60 border border-border/50 rounded-2xl p-6 flex flex-col gap-3 hover:border-primary/30 hover:bg-card/80 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                {f.icon}
              </div>
              <h3 className="text-lg font-display text-foreground">{f.title}</h3>
              <p className="text-sm font-sans text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}

          {/* CTA card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: features.length * 0.08 }}
            className="bg-primary/10 border border-primary/30 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 text-center sm:col-span-2 lg:col-span-1"
          >
            <Swords className="w-10 h-10 text-primary" />
            <h3 className="text-xl font-display text-primary">Ready to begin?</h3>
            <p className="text-sm font-sans text-muted-foreground">Your first campaign is one click away.</p>
            <Button onClick={enter} className="w-full">Enter the Realm</Button>
          </motion.div>
        </div>
      </section>

      {/* ─── Footer ────────────────────────────────────────────────── */}
      <footer className="border-t border-border/30 py-8 text-center text-xs font-sans text-muted-foreground/50 px-6">
        Realms of Replit · Powered by AI · Built for adventurers
      </footer>
    </div>
  );
}
