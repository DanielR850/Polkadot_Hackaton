// Diagnóstico de la mascota para la UI: qué tan urgente es y qué acción conviene. Lógica pura.
import type { Accion, Mascota } from "../contract/polkapets";
import { duracionHumana } from "../lib/format";
import { NECESIDADES, type Necesidad } from "./tiempo";

export type Urgencia = "bien" | "atencion" | "critico" | "muerta";

export interface Diagnostico {
  urgencia: Urgencia;
  /** Acción recomendada; null si está bien o muerta. */
  consejo: Accion | null;
  mensaje: string;
}

const ACCION: Record<Necesidad, Accion> = {
  hambre: "alimentar",
  sed: "alimentar",
  energia: "dormir",
  felicidad: "jugar",
  limpieza: "banar",
};

const QUE_NECESITA: Record<Necesidad, string> = {
  hambre: "comer",
  sed: "beber agua",
  energia: "dormir",
  felicidad: "jugar",
  limpieza: "un baño",
};

export function diagnosticar(m: Mascota): Diagnostico {
  if (!m.viva) {
    return {
      urgencia: "muerta",
      consejo: null,
      mensaje: `${m.nombre} vivió ${duracionHumana(m.duracion)}.`,
    };
  }

  const peor = NECESIDADES.reduce((a, b) => (m[b] < m[a] ? b : a));
  const valor = m[peor];
  const consejo = ACCION[peor];

  if (valor === 0) {
    return {
      urgencia: "critico",
      consejo,
      mensaje: `¡${m.nombre} está perdiendo vida! Necesita ${QUE_NECESITA[peor]} ya.`,
    };
  }
  if (valor < 30 || m.vida < 30) {
    return { urgencia: "atencion", consejo, mensaje: `${m.nombre} necesita ${QUE_NECESITA[peor]}.` };
  }
  return { urgencia: "bien", consejo: null, mensaje: `${m.nombre} está feliz.` };
}

/** Porcentaje hacia el siguiente nivel (0–100). */
export function progresoXp(m: Pick<Mascota, "xp">, xpPorNivel = 100): number {
  return Math.max(0, Math.min(100, Math.round((m.xp / xpPorNivel) * 100)));
}
