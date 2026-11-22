// Cliente del contrato PolkaPetsRanking: partidas registradas al morir la mascota.
// Lecturas por ETH-RPC; el registro se simula y se firma igual que el resto (pets.ts).
import { BaseError, ContractFunctionRevertedError, parseAbi, type Address } from "viem";
import { PETS_ADDRESS, RANKING_ADDRESS, RANKING_MAX_LEER, RANKING_PAGINA } from "./config";
import { escribirLlamada, leerRanking, publicClient, type Firmante, type PasoTx } from "./pets";

/** Misma interfaz que contrato/contracts/PolkaPetsRanking.sol. */
export const rankingAbi = parseAbi([
  "function registrarMuerte(uint256 tokenId, string nombre, uint8 especie, uint64 duracion)",
  "function total() view returns (uint256)",
  "function registrado(uint256 tokenId) view returns (bool)",
  "function pets() view returns (address)",
  "function registros(uint256 desde, uint256 cantidad) view returns ((uint256 tokenId, address dueno, string nombre, uint8 especie, uint64 duracion, uint64 registrado)[])",
  "error NoEresDueno(uint256 tokenId)",
  "error YaRegistrada(uint256 tokenId)",
  "error DuracionInvalida()",
  "error NombreInvalido()",
  "error EspecieInvalida()",
]);

export interface FilaLeaderboard {
  tokenId: bigint;
  dueno: Address;
  nombre: string;
  especie: number;
  /** Segundos vividos. */
  duracion: number;
  /** false = la mascota sigue viva (solo en el ranking de respaldo de PolkaPets). */
  terminada: boolean;
}

/** true si hay contrato de ranking configurado: se puede registrar al morir. */
export const rankingActivo = (): boolean => RANKING_ADDRESS !== null;

const destino = () => ({ address: RANKING_ADDRESS!, abi: rankingAbi });

/**
 * Comprueba que la dirección configurada sea de verdad un PolkaPetsRanking ligado a este PolkaPets.
 * Evita firmar contra una dirección pegada mal.
 */
export async function verificarRanking(): Promise<void> {
  if (!RANKING_ADDRESS) throw new Error("El ranking todavía no está desplegado.");
  let pets: string;
  try {
    pets = await publicClient.readContract({ address: RANKING_ADDRESS, abi: rankingAbi, functionName: "pets" });
  } catch {
    throw new Error("La dirección del ranking no responde como PolkaPetsRanking. Revisa RANKING_ADDRESS.");
  }
  if (pets.toLowerCase() !== PETS_ADDRESS.toLowerCase()) {
    throw new Error("El contrato de ranking está ligado a otro PolkaPets. Despliégalo con la dirección correcta.");
  }
}

export async function yaRegistrada(tokenId: bigint): Promise<boolean> {
  if (!RANKING_ADDRESS) return false;
  return publicClient.readContract({ address: RANKING_ADDRESS, abi: rankingAbi, functionName: "registrado", args: [tokenId] });
}

/** Leaderboard: partidas registradas; sin contrato de ranking, las mascotas de PolkaPets. */
export async function leerLeaderboard(): Promise<FilaLeaderboard[]> {
  if (!RANKING_ADDRESS) {
    return (await leerRanking()).map((f) => ({
      tokenId: f.tokenId, dueno: f.dueno, nombre: f.nombre, especie: f.especie, duracion: f.duracion, terminada: !f.viva,
    }));
  }
  const total = Number(await publicClient.readContract({ address: RANKING_ADDRESS, abi: rankingAbi, functionName: "total" }));
  const hasta = Math.min(total, RANKING_MAX_LEER);
  const paginas = [];
  for (let desde = 0; desde < hasta; desde += RANKING_PAGINA) {
    paginas.push(publicClient.readContract({
      address: RANKING_ADDRESS, abi: rankingAbi, functionName: "registros",
      args: [BigInt(desde), BigInt(Math.min(RANKING_PAGINA, hasta - desde))],
    }));
  }
  return (await Promise.all(paginas)).flat().map((r) => ({
    tokenId: r.tokenId, dueno: r.dueno, nombre: r.nombre, especie: r.especie, duracion: Number(r.duracion), terminada: true,
  }));
}

export interface Partida { tokenId: bigint; nombre: string; especie: number; duracionSeg: number }

/** Firma el registro de una partida terminada. */
export async function registrarPartida(firmante: Firmante, p: Partida, onPaso?: (p: PasoTx) => void): Promise<void> {
  await verificarRanking();
  if (await yaRegistrada(p.tokenId)) throw new Error("YaRegistrada");
  const duracion = BigInt(Math.max(1, Math.floor(p.duracionSeg)));
  await escribirLlamada(firmante, { functionName: "registrarMuerte", args: [p.tokenId, p.nombre.trim(), p.especie, duracion], destino: destino() }, onPaso);
}

/** Mensaje en español para los errores propios del ranking; null si no es uno de ellos. */
export function errorRanking(e: unknown): string | null {
  if (e instanceof Error && e.message === "YaRegistrada") return "Esta partida ya está registrada en el leaderboard.";
  if (e instanceof BaseError) {
    const revert = e.walk((x) => x instanceof ContractFunctionRevertedError);
    const name = revert instanceof ContractFunctionRevertedError ? revert.data?.errorName : undefined;
    if (name === "NoEresDueno") return "Esa cuenta no es dueña del NFT de esta mascota. Conecta la cuenta con la que la adoptaste.";
    if (name === "YaRegistrada") return "Esta partida ya está registrada en el leaderboard.";
    if (name === "DuracionInvalida") return "La duración no es válida para este NFT (no puede ser mayor que el tiempo desde que lo adoptaste).";
    if (name === "NombreInvalido") return "El nombre no es válido para el contrato (máximo 24 bytes).";
    if (name === "EspecieInvalida") return "Esa especie no existe en el contrato de ranking.";
  }
  return null;
}
