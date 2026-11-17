// Simulación del paso del tiempo, idéntica a `_estado` del contrato. Lógica pura.
// La UI la usa para que las barras bajen cada segundo entre dos lecturas de la cadena.
import { Etapa, etapaPorNivel, type Mascota } from "../contract/polkapets";

/** Segundos que tarda cada necesidad en bajar 1 punto (iguales al contrato). */
export const SEG_POR_PUNTO = {
  hambre: 60,
  sed: 45,
  energia: 120,
  felicidad: 90,
  limpieza: 150,
} as const;

/** Segundos de "necesidad en 0" que cuestan 1 punto de vida. */
export const SEG_VIDA = 30;

export type Necesidad = keyof typeof SEG_POR_PUNTO;
export const NECESIDADES: readonly Necesidad[] = ["hambre", "sed", "energia", "felicidad", "limpieza"];
export type Necesidades = Record<Necesidad, number>;

export interface Vital {
  vida: number;
  necesidades: Necesidades;
  /** Segundos (desde el punto de partida) en que muere; null si sigue viva. */
  muerteEn: number | null;
}

/** Avanza `t` segundos desde `vida` y `base`. */
export function avanzar(vida: number, base: Necesidades, t: number): Vital {
  const seg = Math.max(0, Math.floor(t));
  const necesidades = {} as Necesidades;
  const tCero: number[] = [];
  let ceroSeg = 0;

  for (const k of NECESIDADES) {
    const ritmo = SEG_POR_PUNTO[k];
    const perdida = Math.floor(seg / ritmo);
    necesidades[k] = perdida >= base[k] ? 0 : base[k] - perdida;
    const cero = base[k] * ritmo;
    tCero.push(cero);
    if (seg > cero) ceroSeg += seg - cero;
  }

  const limite = vida * SEG_VIDA;
  if (ceroSeg >= limite) {
    for (const k of NECESIDADES) necesidades[k] = 0;
    return { vida: 0, necesidades, muerteEn: momentoMuerte(tCero, limite) };
  }
  return { vida: vida - Math.floor(ceroSeg / SEG_VIDA), necesidades, muerteEn: null };
}

/**
 * Primer segundo en que los segundos en cero acumulados alcanzan `limite`.
 * Mismo algoritmo que `_momentoMuerte` del contrato.
 */
export function momentoMuerte(tCero: readonly number[], limite: number): number {
  if (limite <= 0) return 0;
  const c = [...tCero].sort((a, b) => a - b);
  let acum = 0;
  for (let k = 0; k < c.length; k++) {
    const activos = k + 1;
    const ultimo = k + 1 === c.length;
    const tramo = ultimo ? Infinity : activos * (c[k + 1] - c[k]);
    if (ultimo || acum + tramo >= limite) return c[k] + Math.ceil((limite - acum) / activos);
    acum += tramo;
  }
  return c[c.length - 1];
}

/** La mascota `t` segundos después de leerla de la cadena. */
export function mascotaAhora(m: Mascota, t: number): Mascota {
  if (!m.viva || t <= 0) return m;
  const v = avanzar(
    m.vida,
    { hambre: m.hambre, sed: m.sed, energia: m.energia, felicidad: m.felicidad, limpieza: m.limpieza },
    t,
  );
  const muerta = v.muerteEn !== null;
  const transcurrido = muerta ? (v.muerteEn as number) : Math.floor(t);
  const enCero = NECESIDADES.some((k) => v.necesidades[k] === 0);
  return {
    ...m,
    ...v.necesidades,
    vida: v.vida,
    viva: !muerta,
    etapa: muerta ? Etapa.Muerta : enCero ? Etapa.Enferma : etapaPorNivel(m.nivel),
    duracion: m.duracion + transcurrido,
    muerte: muerta ? m.nacimiento + m.duracion + transcurrido : 0,
  };
}
