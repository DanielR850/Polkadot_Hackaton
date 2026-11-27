// Cliente del contrato PolkaPetsTemporadas: Competencia semanal (lunes a viernes, hora de México).
// Lecturas por ETH-RPC; registrar y cerrar se simulan y se firman igual que el resto (pets.ts).
import { BaseError, ContractFunctionRevertedError, parseAbi, type Address } from "viem";
import { PETS_ADDRESS, TEMPORADAS_ADDRESS } from "./config";
import { decodeRanking, escribirLlamada, polkaPetsAbi, publicClient, verMascota, type Firmante, type PasoTx } from "./pets";

/** Misma interfaz que contrato/contracts/PolkaPetsTemporadas.sol. */
export const temporadasAbi = parseAbi([
  "function semanaActual() view returns (uint256 semana, bool abierta, uint64 abre, uint64 cierra)",
  "function registrar(uint256 tokenId)",
  "function cerrarTemporada(uint256 semana)",
  "function setPausada(bool valor)",
  "function pausada() view returns (bool)",
  "function owner() view returns (address)",
  "function inicio() view returns (uint64)",
  "function diasAbierta() view returns (uint8)",
  "function cerrada(uint256 semana) view returns (bool)",
  "function registrado(uint256 tokenId) view returns (bool)",
  "function total(uint256 semana) view returns (uint256)",
  "function registros(uint256 semana, uint256 desde, uint256 cantidad) view returns ((uint256 tokenId, address dueno, string nombre, uint8 especie, uint8 horas, uint64 duracion, uint64 registrado)[])",
  "function podio(uint256 semana) view returns ((uint256 tokenId, address dueno, string nombre, uint8 especie, uint8 horas, uint64 duracion, uint64 registrado)[])",
  "function semanasCerradas() view returns (uint256[])",
  "error TemporadaCerradaAhora()",
  "error EnPausa()",
  "error NoEresDueno(uint256 tokenId)",
  "error NoEsCompetencia(uint256 tokenId)",
  "error SigueViva(uint256 tokenId)",
  "error DeOtraTemporada(uint256 tokenId)",
  "error YaRegistrada(uint256 tokenId)",
  "error TemporadaLlena()",
  "error TemporadaEnCurso(uint256 semana)",
  "error YaCerrada(uint256 semana)",
  "error OwnableUnauthorizedAccount(address account)",
]);

export interface Temporada {
  semana: number;
  abierta: boolean;
  /** Timestamps en ms. */
  abre: number;
  cierra: number;
  pausada: boolean;
}

export interface RegistroTemporada {
  tokenId: bigint;
  dueno: Address;
  nombre: string;
  especie: number;
  horas: number;
  /** Segundos que vivió (lo calcula PolkaPets en la cadena). */
  duracion: number;
}

/** true si hay contrato de temporadas configurado (Competencia v2). */
export const temporadasActivas = (): boolean => TEMPORADAS_ADDRESS !== null;
const destino = () => ({ address: TEMPORADAS_ADDRESS!, abi: temporadasAbi });
const leer = <T>(functionName: string, args: readonly unknown[] = []) =>
  publicClient.readContract({ address: TEMPORADAS_ADDRESS!, abi: temporadasAbi, functionName, args } as never) as Promise<T>;

const fila = (r: { tokenId: bigint; dueno: Address; nombre: string; especie: number; horas: number; duracion: bigint }): RegistroTemporada => ({
  tokenId: r.tokenId, dueno: r.dueno, nombre: r.nombre, especie: Number(r.especie), horas: Number(r.horas), duracion: Number(r.duracion),
});

export async function leerTemporada(): Promise<Temporada | null> {
  if (!TEMPORADAS_ADDRESS) return null;
  const [[semana, abierta, abre, cierra], pausada] = await Promise.all([
    leer<readonly [bigint, boolean, bigint, bigint]>("semanaActual"),
    leer<boolean>("pausada"),
  ]);
  return { semana: Number(semana), abierta, abre: Number(abre) * 1000, cierra: Number(cierra) * 1000, pausada };
}

/** Registros de la temporada en curso (todavía sin cerrar). */
export async function leerRegistros(semana: number): Promise<RegistroTemporada[]> {
  if (!TEMPORADAS_ADDRESS) return [];
  const total = Number(await leer<bigint>("total", [BigInt(semana)]));
  const paginas = [];
  for (let desde = 0; desde < total; desde += 50) {
    paginas.push(leer<Parameters<typeof fila>[0][]>("registros", [BigInt(semana), BigInt(desde), BigInt(Math.min(50, total - desde))]));
  }
  return (await Promise.all(paginas)).flat().map(fila);
}

export interface RegistroEnVivo extends RegistroTemporada {
  /** true = sigue viva en la cadena (su duración sigue creciendo). */
  viva: boolean;
}

/**
 * La competencia en vivo: todas las mascotas de Competencia adoptadas desde `abreMs` (inicio de la
 * semana), vivas o muertas, leídas directo de PolkaPets. No hace falta que nadie registre nada para
 * aparecer; registrar solo sirve para el podio al cerrar. Recorre las adopciones de la más nueva a la
 * más vieja y se detiene al llegar a una anterior a la semana.
 */
export async function leerEnVivo(abreMs: number, max = 150): Promise<RegistroEnVivo[]> {
  const total = Number(await publicClient.readContract({ address: PETS_ADDRESS, abi: polkaPetsAbi, functionName: "totalMascotas" } as never));
  const salida: RegistroEnVivo[] = [];
  const LOTE = 25;
  let hasta = total; // ids hasta..(hasta-LOTE+1)
  while (hasta > 0 && total - hasta < max) {
    const desde = Math.max(1, hasta - LOTE + 1);
    const ids = Array.from({ length: hasta - desde + 1 }, (_, i) => BigInt(desde + i));
    const [mascotas, filas] = await Promise.all([
      Promise.all(ids.map((id) => verMascota(id))),
      publicClient.readContract({ address: PETS_ADDRESS, abi: polkaPetsAbi, functionName: "ranking", args: [BigInt(desde - 1), BigInt(ids.length)] } as never).then(decodeRanking),
    ]);
    let hayAnteriores = false;
    mascotas.forEach((m, i) => {
      if (m.nacimiento * 1000 < abreMs) { hayAnteriores = true; return; }
      if (m.modo !== 1) return;
      salida.push({ tokenId: m.tokenId, dueno: filas[i]?.dueno ?? "0x", nombre: m.nombre, especie: m.especie, horas: m.horas, duracion: m.duracion, viva: m.viva });
    });
    if (hayAnteriores) break;
    hasta = desde - 1;
  }
  return salida;
}

/** Campeones: podio guardado de cada semana cerrada, de la más reciente a la más vieja. */
export async function leerCampeones(max = 8): Promise<Array<{ semana: number; podio: RegistroTemporada[] }>> {
  if (!TEMPORADAS_ADDRESS) return [];
  const semanas = (await leer<readonly bigint[]>("semanasCerradas")).map(Number).reverse().slice(0, max);
  const podios = await Promise.all(semanas.map((s) => leer<Parameters<typeof fila>[0][]>("podio", [BigInt(s)])));
  return semanas.map((semana, i) => ({ semana, podio: podios[i].map(fila) }));
}

export async function yaRegistradaTemporada(tokenId: bigint): Promise<boolean> {
  if (!TEMPORADAS_ADDRESS) return false;
  return leer<boolean>("registrado", [tokenId]);
}

/** Semanas anteriores que terminaron pero nadie cerró (su podio aún no se guardó). */
export async function semanasSinCerrar(actual: number, abiertaAhora: boolean): Promise<number[]> {
  if (!TEMPORADAS_ADDRESS) return [];
  const candidatas = [actual - 1, actual - 2, actual - 3].filter((s) => s >= 0);
  if (!abiertaAhora) candidatas.unshift(actual);
  const res = await Promise.all(candidatas.map(async (s) => {
    const [cerrada, total] = await Promise.all([leer<boolean>("cerrada", [BigInt(s)]), leer<bigint>("total", [BigInt(s)])]);
    return !cerrada && total > 0n ? s : -1;
  }));
  return res.filter((s) => s >= 0);
}

/** Firma el registro de una mascota de Competencia que murió (la duración la pone la cadena). */
export async function registrarEnTemporada(firmante: Firmante, tokenId: bigint, onPaso?: (p: PasoTx) => void): Promise<void> {
  if (await yaRegistradaTemporada(tokenId)) throw new Error("YaRegistrada");
  await escribirLlamada(firmante, { functionName: "registrar", args: [tokenId], destino: destino() }, onPaso);
}

export async function cerrarTemporada(firmante: Firmante, semana: number, onPaso?: (p: PasoTx) => void): Promise<void> {
  await escribirLlamada(firmante, { functionName: "cerrarTemporada", args: [BigInt(semana)], destino: destino() }, onPaso);
}

/* ------------------------------------------------------------------ admin */

export async function leerAdminTemporadas(): Promise<{ owner: Address; inicio: number; diasAbierta: number } | null> {
  if (!TEMPORADAS_ADDRESS) return null;
  const [owner, inicio, dias] = await Promise.all([leer<Address>("owner"), leer<bigint>("inicio"), leer<number>("diasAbierta")]);
  return { owner, inicio: Number(inicio) * 1000, diasAbierta: Number(dias) };
}

export async function pausarTemporadas(firmante: Firmante, pausada: boolean, onPaso?: (p: PasoTx) => void): Promise<void> {
  await escribirLlamada(firmante, { functionName: "setPausada", args: [pausada], destino: destino() }, onPaso);
}

/* ------------------------------------------------- calendario (lógica pura) */

const DIA = 86_400_000;
const SEMANA = 7 * DIA;
/** Lunes 1970-01-05 00:00 en México (UTC-6) en ms. Igual que contrato/scripts/deployV2.ts. */
export const LUNES_MEXICO_MS = 367_200_000;

/**
 * Temporada calculada en el cliente (para el modo sin contrato y para mostrar la cuenta regresiva
 * antes de leer la cadena): semana, si está abierta y cuándo abre y cierra.
 */
export function calendario(ahora: number, inicio = LUNES_MEXICO_MS, diasAbierta = 5): Omit<Temporada, "pausada"> {
  const semana = ahora < inicio ? 0 : Math.floor((ahora - inicio) / SEMANA);
  const abre = inicio + semana * SEMANA;
  const cierra = abre + diasAbierta * DIA;
  return { semana, abierta: ahora >= abre && ahora < cierra, abre, cierra };
}

/** Mensaje en español para los errores de temporadas; null si no es uno de ellos. */
export function errorTemporadas(e: unknown): string | null {
  if (e instanceof Error && e.message === "YaRegistrada") return "Esta mascota ya está registrada en la temporada.";
  if (!(e instanceof BaseError)) return null;
  const revert = e.walk((x) => x instanceof ContractFunctionRevertedError);
  const name = revert instanceof ContractFunctionRevertedError ? revert.data?.errorName : undefined;
  switch (name) {
    case "TemporadaCerradaAhora": return "La temporada está cerrada: abre el lunes a las 00:00 y cierra al terminar el viernes.";
    case "EnPausa": return "La competencia está en pausa por el administrador.";
    case "NoEresDueno": return "Esa cuenta no es dueña del NFT de esta mascota.";
    case "NoEsCompetencia": return "Solo las mascotas en modo Competencia entran a la temporada.";
    case "SigueViva": return "Tu mascota sigue viva en la blockchain: se registra cuando muere.";
    case "DeOtraTemporada": return "Esta mascota se adoptó en otra temporada; adopta una nueva para competir esta semana.";
    case "YaRegistrada": return "Esta mascota ya está registrada en la temporada.";
    case "TemporadaLlena": return "La temporada ya llegó al máximo de registros.";
    case "TemporadaEnCurso": return "Esa temporada todavía no termina.";
    case "YaCerrada": return "Esa temporada ya se cerró.";
    case "OwnableUnauthorizedAccount": return "Solo la cuenta administradora del contrato puede hacer eso.";
    default: return null;
  }
}
