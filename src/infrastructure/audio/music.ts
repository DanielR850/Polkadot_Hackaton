// Música de fondo original, generada en el navegador con Web Audio: sin archivos, sin derechos
// de terceros y sin peticiones de red (sirve igual dentro del Host). Estilo chiptune en 6/8 con
// aire de son: bajo en 1 y 4, acordes en los demás tiempos y una melodía de onda cuadrada.
// La melodía y el arreglo son propios de este proyecto.

type Note = [pitch: string | null, eighths: number];

/** Corcheas por segundo: negra con punto = 72. */
const EIGHTH = 60 / (72 * 3);
const BAR = 6;

/** 16 compases, cada uno suma 6 corcheas. null = silencio. */
const MELODY: Note[][] = [
  [['E5', 2], ['G5', 1], ['E5', 1], ['D5', 1], ['C5', 1]],
  [['D5', 2], ['B4', 1], ['G4', 2], ['B4', 1]],
  [['C5', 2], ['E5', 1], ['A5', 2], ['G5', 1]],
  [['F5', 3], ['E5', 1], ['D5', 1], ['C5', 1]],
  [['E5', 1], ['F5', 1], ['G5', 2], ['E5', 1], ['C5', 1]],
  [['D5', 1], ['E5', 1], ['D5', 1], ['B4', 2], ['G4', 1]],
  [['A4', 1], ['C5', 1], ['F5', 2], ['E5', 1], ['D5', 1]],
  [['D5', 2], ['G4', 1], ['C5', 3]],
  [['A5', 2], ['G5', 1], ['E5', 2], ['C5', 1]],
  [['F5', 2], ['E5', 1], ['C5', 2], ['A4', 1]],
  [['G5', 2], ['E5', 1], ['C5', 1], ['D5', 1], ['E5', 1]],
  [['D5', 3], ['B4', 3]],
  [['C5', 1], ['E5', 1], ['A5', 2], ['B5', 1], ['A5', 1]],
  [['G5', 1], ['F5', 1], ['E5', 2], ['D5', 1], ['C5', 1]],
  [['D5', 2], ['E5', 1], ['F5', 1], ['E5', 1], ['D5', 1]],
  [['C5', 4], [null, 2]],
];

/** Acorde de cada compás: [bajo, quinta del bajo, notas del acorde]. */
const CHORDS: Record<string, [string, string, string[]]> = {
  C: ['C3', 'G2', ['C4', 'E4', 'G4']],
  G: ['G2', 'D3', ['B3', 'D4', 'G4']],
  Am: ['A2', 'E3', ['A3', 'C4', 'E4']],
  F: ['F2', 'C3', ['A3', 'C4', 'F4']],
};
const PROGRESSION = ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'C'];

const SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function freq(pitch: string): number {
  const name = pitch[0];
  const octave = Number(pitch.slice(-1));
  const midi = 12 * (octave + 1) + SEMITONE[name];
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Eventos de un compás, en corcheas desde el inicio del compás. */
interface Event { at: number; kind: 'lead' | 'bass' | 'chord' | 'hat' | 'kick'; pitch?: string; pitches?: string[]; length: number }

function barEvents(bar: number): Event[] {
  const events: Event[] = [];
  let at = 0;
  for (const [pitch, length] of MELODY[bar]) {
    if (pitch) events.push({ at, kind: 'lead', pitch, length });
    at += length;
  }
  const [root, fifth, triad] = CHORDS[PROGRESSION[bar]];
  events.push({ at: 0, kind: 'bass', pitch: root, length: 2 }, { at: 3, kind: 'bass', pitch: fifth, length: 2 });
  for (const step of [1, 2, 4, 5]) events.push({ at: step, kind: 'chord', pitches: triad, length: 0.6 });
  events.push({ at: 0, kind: 'kick', length: 1 }, { at: 3, kind: 'kick', length: 1 });
  for (let step = 0; step < BAR; step++) events.push({ at: step, kind: 'hat', length: 0.25 });
  return events;
}

export interface Music {
  /** 0–1. */
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  /** Llamar desde un gesto del usuario (clic, toque o tecla): los navegadores lo exigen. */
  unlock(): void;
}

export function createMusic(initial: { volume: number; muted: boolean }): Music {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let volume = initial.volume;
  let muted = initial.muted;
  let timer = 0;
  let nextBarTime = 0;
  let bar = 0;

  /** Curva suave: el oído percibe el volumen de forma logarítmica. Tope bajo para música de fondo. */
  const gainFor = () => (muted ? 0 : volume * volume * 0.32);

  function tone(type: OscillatorType, f: number, start: number, length: number, peak: number) {
    const osc = ctx!.createOscillator();
    const env = ctx!.createGain();
    osc.type = type;
    osc.frequency.value = f;
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(peak, start + 0.012);
    env.gain.exponentialRampToValueAtTime(Math.max(peak * 0.35, 0.0001), start + length * 0.6);
    env.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(env).connect(master!);
    osc.start(start);
    osc.stop(start + length + 0.02);
  }

  function kick(start: number) {
    const osc = ctx!.createOscillator();
    const env = ctx!.createGain();
    osc.frequency.setValueAtTime(120, start);
    osc.frequency.exponentialRampToValueAtTime(45, start + 0.12);
    env.gain.setValueAtTime(0.5, start);
    env.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
    osc.connect(env).connect(master!);
    osc.start(start);
    osc.stop(start + 0.18);
  }

  function hat(start: number, accent: boolean) {
    const src = ctx!.createBufferSource();
    src.buffer = noise;
    const hp = ctx!.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const env = ctx!.createGain();
    env.gain.setValueAtTime(accent ? 0.12 : 0.06, start);
    env.gain.exponentialRampToValueAtTime(0.0001, start + 0.05);
    src.connect(hp).connect(env).connect(master!);
    src.start(start);
    src.stop(start + 0.06);
  }

  function scheduleBar(start: number, index: number) {
    for (const e of barEvents(index)) {
      const t = start + e.at * EIGHTH;
      const len = e.length * EIGHTH;
      if (e.kind === 'lead') tone('square', freq(e.pitch!), t, len * 0.92, 0.11);
      else if (e.kind === 'bass') tone('triangle', freq(e.pitch!), t, len * 0.9, 0.32);
      else if (e.kind === 'chord') for (const p of e.pitches!) tone('square', freq(p), t, len, 0.025);
      else if (e.kind === 'kick') kick(t);
      else hat(t, e.at % 3 === 0);
    }
  }

  /** Programa con anticipación para que el ritmo no dependa de setInterval. */
  function tick() {
    if (!ctx) return;
    while (nextBarTime < ctx.currentTime + 0.4) {
      scheduleBar(nextBarTime, bar);
      nextBarTime += BAR * EIGHTH;
      bar = (bar + 1) % MELODY.length;
    }
  }

  function start() {
    if (!ctx || timer) return;
    nextBarTime = Math.max(nextBarTime, ctx.currentTime + 0.1);
    tick();
    timer = window.setInterval(tick, 100);
  }

  function stop() {
    window.clearInterval(timer);
    timer = 0;
  }

  /** Sonando solo si no está silenciada y la pestaña se ve. Silenciada no gasta batería. */
  function update() {
    if (!ctx || !master) return;
    master.gain.setTargetAtTime(gainFor(), ctx.currentTime, 0.05);
    const shouldPlay = !muted && volume > 0 && document.visibilityState === 'visible';
    if (shouldPlay) {
      void ctx.resume();
      start();
    } else {
      stop();
      // Espera a que baje el volumen antes de suspender, para que no haga clic.
      window.setTimeout(() => { if (!timer) void ctx?.suspend(); }, 200);
    }
  }

  document.addEventListener('visibilitychange', update);

  return {
    setVolume(v) { volume = Math.max(0, Math.min(1, v)); update(); },
    setMuted(m) { muted = m; update(); },
    unlock() {
      if (ctx) { update(); return; }
      const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      update();
    },
  };
}

/* ------------------------------------------------------- preferencias */

const PREFS_KEY = 'tamagotchi-polkadot-sound-v1';

export function loadSoundPrefs(): { volume: number; muted: boolean } {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as { volume?: unknown; muted?: unknown } | null;
    const volume = typeof raw?.volume === 'number' && raw.volume >= 0 && raw.volume <= 1 ? raw.volume : 0.5;
    return { volume, muted: raw?.muted === true };
  } catch {
    return { volume: 0.5, muted: false };
  }
}

export function saveSoundPrefs(prefs: { volume: number; muted: boolean }): void {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* sin localStorage */ }
}
