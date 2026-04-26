// Lightweight Web Audio synth for subtle UI sounds.
// No external assets — all sounds are generated.

const STORAGE_KEY = "ror:sound-muted";
const listeners = new Set<(muted: boolean) => void>();

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function readMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const W = window as unknown as { webkitAudioContext?: typeof AudioContext };
  const Ctor = window.AudioContext || W.webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    try {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.6;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
  }
  // Some browsers suspend the context until a user gesture.
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

type Tone = {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  detune?: number;
};

function playTones(tones: Tone[]) {
  if (readMuted()) return;
  const c = ensureCtx();
  if (!c || !master) return;
  const now = c.currentTime;
  for (const t of tones) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = t.type ?? "sine";
    osc.frequency.value = t.freq;
    if (t.detune) osc.detune.value = t.detune;
    const start = now + (t.delay ?? 0);
    const peak = (t.gain ?? 1) * 0.85;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + t.duration);
    osc.connect(g);
    g.connect(master);
    osc.start(start);
    osc.stop(start + t.duration + 0.05);
  }
}

export const sound = {
  click() {
    playTones([{ freq: 880, duration: 0.06, type: "triangle", gain: 0.6 }]);
  },
  hover() {
    playTones([{ freq: 1320, duration: 0.04, type: "sine", gain: 0.25 }]);
  },
  themeChange() {
    // Quick three-note arpeggio
    playTones([
      { freq: 523.25, duration: 0.18, type: "sine", gain: 0.7 },           // C5
      { freq: 659.25, duration: 0.18, type: "sine", gain: 0.7, delay: 0.06 }, // E5
      { freq: 783.99, duration: 0.28, type: "sine", gain: 0.8, delay: 0.12 }, // G5
    ]);
  },
  toggleOn() {
    playTones([
      { freq: 440, duration: 0.1, type: "triangle", gain: 0.7 },
      { freq: 660, duration: 0.14, type: "triangle", gain: 0.7, delay: 0.05 },
    ]);
  },
  toggleOff() {
    playTones([
      { freq: 660, duration: 0.1, type: "triangle", gain: 0.5 },
      { freq: 330, duration: 0.14, type: "triangle", gain: 0.5, delay: 0.05 },
    ]);
  },
};

export function isMuted(): boolean {
  return readMuted();
}

export function setMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
  listeners.forEach((fn) => fn(muted));
  if (!muted) {
    // Play a short confirmation when unmuting
    sound.toggleOn();
  }
}

export function subscribeMuted(fn: (m: boolean) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
