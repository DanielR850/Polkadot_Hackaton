// Utilidades de formato puras (sin DOM).

/** 0x1234…abcd */
export function acortarDireccion(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Segundos a texto: "45 s", "12 min 5 s", "3 h 20 min", "2 d 4 h". */
export function duracionHumana(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  if (s < 60) return `${s} s`;
  if (s < 3600) {
    const r = s % 60;
    return r ? `${Math.floor(s / 60)} min ${r} s` : `${Math.floor(s / 60)} min`;
  }
  if (s < 86400) {
    const r = Math.floor((s % 3600) / 60);
    return r ? `${Math.floor(s / 3600)} h ${r} min` : `${Math.floor(s / 3600)} h`;
  }
  const r = Math.floor((s % 86400) / 3600);
  return r ? `${Math.floor(s / 86400)} d ${r} h` : `${Math.floor(s / 86400)} d`;
}

/** Recorta un stat al rango 0–100. */
export function clampStat(valor: number): number {
  if (!Number.isFinite(valor)) return 0;
  return Math.max(0, Math.min(100, Math.round(valor)));
}
