// Tipos de dominio del contrato PolkaPets y decodificación de lo que devuelve viem.
import type { Abi } from "viem";
import abiJson from "./polkapets.abi.json";

/** Generada con `npm run contrato:abi` desde contrato/contracts/PolkaPets.sol. No se edita a mano. */
export const polkaPetsAbi = abiJson as unknown as Abi;

export type Hex = `0x${string}`;

/** Mismo orden que el enum Etapa del contrato. */
export enum Etapa {
  Bebe = 0,
  Joven = 1,
  Adulta = 2,
  Enferma = 3,
  Muerta = 4,
}

/** Acciones de cuidado (nombres de función del contrato). */
export type Accion = "alimentar" | "jugar" | "dormir" | "banar";

export interface Especie {
  id: number;
  slug: string;
  nombre: string;
  emoji: string;
  descripcion: string;
}

/** Mismo orden que los ids del contrato (0..NUM_ESPECIES-1). */
export const ESPECIES: readonly Especie[] = [
  { id: 0, slug: "axolotl", nombre: "Ajolote", emoji: "🦎", descripcion: "Tu compañero acuático." },
  { id: 1, slug: "wolf", nombre: "Lobo", emoji: "🐺", descripcion: "Curioso y juguetón." },
  { id: 2, slug: "bear", nombre: "Oso grizzly", emoji: "🐻", descripcion: "Dulce y aventurero." },
  { id: 3, slug: "opossum", nombre: "Tlacuache", emoji: "🐾", descripcion: "Travieso y nocturno." },
  { id: 4, slug: "manatee", nombre: "Manatí", emoji: "🦭", descripcion: "Tranquilo y amigable." },
];

export function especie(id: number): Especie {
  return ESPECIES[id] ?? ESPECIES[0];
}

/** Estado de una mascota tal como lo devuelve `verMascota` (tiempo ya aplicado). */
export interface Mascota {
  tokenId: bigint;
  nombre: string;
  especie: number;
  nacimiento: number; // timestamp (s)
  ultimaInteraccion: number;
  vida: number;
  hambre: number;
  sed: number;
  energia: number;
  felicidad: number;
  limpieza: number;
  nivel: number;
  xp: number;
  viva: boolean;
  etapa: Etapa;
  duracion: number; // segundos vividos
  muerte: number; // timestamp de la muerte, 0 si vive
}

/** Una fila del ranking tal como la devuelve `ranking()`. */
export interface FilaRanking {
  tokenId: bigint;
  dueno: Hex;
  nombre: string;
  especie: number;
  duracion: number;
  viva: boolean;
}

const num = (v: unknown): number => Number(v ?? 0);
const big = (v: unknown): bigint => BigInt((v as bigint | number | string | undefined) ?? 0);

/** viem devuelve los structs con nombres como objetos. */
export function decodeMascota(raw: unknown): Mascota {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    tokenId: big(o.tokenId),
    nombre: String(o.nombre ?? ""),
    especie: num(o.especie),
    nacimiento: num(o.nacimiento),
    ultimaInteraccion: num(o.ultimaInteraccion),
    vida: num(o.vida),
    hambre: num(o.hambre),
    sed: num(o.sed),
    energia: num(o.energia),
    felicidad: num(o.felicidad),
    limpieza: num(o.limpieza),
    nivel: num(o.nivel),
    xp: num(o.xp),
    viva: Boolean(o.viva),
    etapa: num(o.etapa) as Etapa,
    duracion: num(o.duracion),
    muerte: num(o.muerte),
  };
}

export function decodeRanking(raw: unknown): FilaRanking[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((fila) => {
    const o = (fila ?? {}) as Record<string, unknown>;
    return {
      tokenId: big(o.tokenId),
      dueno: String(o.dueno ?? "0x") as Hex,
      nombre: String(o.nombre ?? ""),
      especie: num(o.especie),
      duracion: num(o.duracion),
      viva: Boolean(o.viva),
    };
  });
}

/** El contrato limita el nombre a 24 bytes UTF-8 (una "ñ" o una "ü" ocupan 2). */
export const NOMBRE_MAX_BYTES = 24;

export function bytesUtf8(texto: string): number {
  return new TextEncoder().encode(texto).length;
}

export function nombreValido(nombre: string): boolean {
  const n = nombre.trim();
  return n.length > 0 && bytesUtf8(n) <= NOMBRE_MAX_BYTES;
}

export function etiquetaEtapa(etapa: Etapa): string {
  switch (etapa) {
    case Etapa.Bebe:
      return "Bebé";
    case Etapa.Joven:
      return "Adolescente";
    case Etapa.Adulta:
      return "Adulta";
    case Etapa.Enferma:
      return "Enferma";
    case Etapa.Muerta:
      return "Muerta";
  }
}

/** Etapa por nivel, para una mascota viva y sin necesidades en 0 (igual que el contrato). */
export function etapaPorNivel(nivel: number): Etapa {
  if (nivel >= 10) return Etapa.Adulta;
  if (nivel >= 2) return Etapa.Joven;
  return Etapa.Bebe;
}
