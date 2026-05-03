import { useEffect, useRef, useState } from "react";
import { Palette, Check } from "lucide-react";
import { THEMES, type ThemeId, getTheme, setTheme, subscribeTheme } from "@/lib/theme";

export function ThemeMenu({ align = "right" }: { align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<ThemeId>(() => getTheme());
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => subscribeTheme(setCurrent), []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const activeMeta = THEMES.find((t) => t.id === current) ?? THEMES[0];

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-2 text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
        title={`Theme: ${activeMeta.label}`}
        aria-label={`Change theme — current: ${activeMeta.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="theme-menu"
      >
        <Palette className="w-5 h-5" />
        <span
          className="hidden lg:inline-block w-2.5 h-2.5 rounded-full ring-1 ring-border"
          style={{ background: activeMeta.swatch[0] }}
        />
      </button>

      {open && (
        <div
          id="theme-menu"
          role="menu"
          aria-label="Theme options"
          className={`absolute top-full mt-2 w-72 rounded-md border border-border/60 bg-card/95 backdrop-blur-md shadow-2xl shadow-black/60 overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150 ${align === "left" ? "left-0" : "right-0"}`}
        >
          <div className="px-3 py-2 border-b border-border/50">
            <div className="font-display text-sm tracking-widest text-primary">THEME</div>
            <div className="text-xs text-muted-foreground italic">Choose your aesthetic</div>
          </div>
          <ul className="py-1">
            {THEMES.map((t) => {
              const isActive = t.id === current;
              return (
                <li key={t.id}>
                  <button
                    onClick={() => {
                      setTheme(t.id);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-accent/40 group transition-colors ${
                      isActive ? "bg-accent/30" : ""
                    }`}
                  >
                    <span className="flex shrink-0">
                      <span
                        className="w-5 h-5 rounded-full ring-1 ring-border"
                        style={{ background: t.swatch[0] }}
                      />
                      <span
                        className="w-5 h-5 rounded-full ring-1 ring-border -ml-2"
                        style={{ background: t.swatch[1] }}
                      />
                    </span>
                    <span className="flex-1 min-w-0">
                      <div className="font-display text-sm text-foreground tracking-wide">
                        {t.label}
                      </div>
                      <div className="text-xs text-muted-foreground italic truncate">
                        {t.tagline}
                      </div>
                    </span>
                    {isActive && <Check className="w-4 h-4 text-primary shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
