// Orden del ranking de longevidad. Lógica pura: el contrato devuelve las filas sin ordenar.
import type { FilaRanking } from "../contract/polkapets";

export interface FilaVista extends FilaRanking {
  posicion: number;
  mia: boolean;
}

/** Más duración primero; a igual duración, la adoptada antes. */
export function ordenarRanking(filas: readonly FilaRanking[], cuenta: string | null, limite = 10): FilaVista[] {
  const yo = cuenta?.toLowerCase() ?? null;
  return [...filas]
    .sort((a, b) => b.duracion - a.duracion || (a.tokenId < b.tokenId ? -1 : a.tokenId > b.tokenId ? 1 : 0))
    .slice(0, limite)
    .map((f, i) => ({ ...f, posicion: i + 1, mia: yo !== null && f.dueno.toLowerCase() === yo }));
}
