// Monedero local: pesitos 🪙 que se ganan en los minijuegos. Se guarda en el dispositivo y no
// pertenece a una mascota: si empiezas otra, conservas tus monedas y tus récords.
// Mismo patrón que storage.ts: localStorage con respaldo en memoria.

export interface Purse {
  coins: number;
  /** Momento (ms) de la última partida cobrada; para el tiempo de espera entre partidas. */
  lastPlayAt: number;
  best: { catch: number; pong: number };
}

const KEY = 'tamagotchi-polkadot-purse-v1';
const EMPTY: Purse = { coins: 0, lastPlayAt: 0, best: { catch: 0, pong: 0 } };
let memory: string | null = null;

const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

export function loadPurse(): Purse {
  let raw = memory;
  try { raw = localStorage.getItem(KEY); } catch { /* sin localStorage */ }
  try {
    const d = raw ? (JSON.parse(raw) as Partial<Purse>) : null;
    if (!d) return { ...EMPTY, best: { ...EMPTY.best } };
    return { coins: count(d.coins), lastPlayAt: count(d.lastPlayAt), best: { catch: count(d.best?.catch), pong: count(d.best?.pong) } };
  } catch {
    return { ...EMPTY, best: { ...EMPTY.best } };
  }
}

export function savePurse(purse: Purse): void {
  memory = JSON.stringify(purse);
  try { localStorage.setItem(KEY, memory); } catch { /* se queda en memoria */ }
}
