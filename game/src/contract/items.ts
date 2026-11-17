// Cliente del contrato PolkaPetsItems: accesorios y muebles como NFT ligados a cada mascota.
// Lecturas por ETH-RPC; compra y legado se simulan y se firman igual que el resto (pets.ts).
import { BaseError, ContractFunctionExecutionError, ContractFunctionRevertedError, parseAbi } from "viem";
import { ITEMS_ADDRESS, PETS_ADDRESS } from "./config";
import { escribirLlamada, publicClient, type Firmante, type PasoTx } from "./pets";

/** Misma interfaz que contrato/contracts/PolkaPetsItems.sol. */
export const itemsAbi = parseAbi([
  "function comprar(uint256 mascotaId, uint16 articuloId) returns (uint256 tokenId)",
  "function reclamarLogro(uint256 mascotaId, uint16 logroId) returns (uint256 tokenId)",
  "function logrosDe(uint256 mascotaId) view returns (uint16[])",
  "function tokenLogro(uint256 mascotaId, uint16 logroId) view returns (uint256)",
  "function sellarLegado(uint256 mascotaId, uint64 duracion, uint16[] equipados)",
  "function pets() view returns (address)",
  "function tokenComprado(uint256 mascotaId, uint16 articuloId) view returns (uint256)",
  "function compradosDe(uint256 mascotaId) view returns (uint16[])",
  "function validarEquipo(uint256 mascotaId, uint16[] equipados) view",
  "function verLegado(uint256 mascotaId) view returns ((bool sellado, uint64 duracion, uint64 selladoEn, uint16[] comprados, uint16[] equipados, uint16[] logros))",
  "error NoEresDueno(uint256 mascotaId)",
  "error MascotaMuerta(uint256 mascotaId)",
  "error LegadoYaSellado(uint256 mascotaId)",
  "error ArticuloInvalido(uint16 articuloId)",
  "error SoloPorLogro(uint16 articuloId)",
  "error YaComprado(uint256 mascotaId, uint16 articuloId)",
  "error NoComprado(uint256 mascotaId, uint16 articuloId)",
  "error LugarRepetido(uint8 tipo)",
  "error CategoriaRepetida(uint8 tipo, uint8 categoria)",
  "error SinLugar(uint8 tipo)",
  "error LogroInvalido(uint16 logroId)",
  "error LogroYaReclamado(uint256 mascotaId, uint16 logroId)",
  "error LogroNoAlcanzado(uint16 logroId)",
  "error DuracionInvalida()",
  "error NoTransferible()",
  // v2: comida, utilidad y drops.
  "function version() pure returns (uint8)",
  "function owner() view returns (address)",
  "function usar(uint256 tokenId)",
  "function reclamarDrop(uint256 mascotaId) returns (uint256 tokenId)",
  "function dropsDisponibles(uint256 mascotaId) view returns (uint256)",
  "function despensaDe(uint256 mascotaId) view returns (uint256[] tokens, uint16[] articulos)",
  "function intervaloDrop() view returns (uint64)",
  "function setIntervaloDrop(uint64 segundos)",
  "error NoEsComida(uint256 tokenId)",
  "error SinDrops(uint256 mascotaId)",
  "error NoSePonen(uint16 articuloId)",
  "error OwnableUnauthorizedAccount(address account)",
]);

/** Lo que se guardó de una mascota que murió. */
export interface LegadoMascota {
  sellado: boolean;
  /** Segundos que vivió. */
  duracion: number;
  /** Ids del catálogo de la tienda. */
  comprados: number[];
  equipados: number[];
  /** Ids de los logros (trofeos) que ganó. */
  logros: number[];
}

/** true si hay contrato de objetos configurado: la tienda mintea NFT y se puede guardar el legado. */
export const itemsActivo = (): boolean => ITEMS_ADDRESS !== null;

const destino = () => ({ address: ITEMS_ADDRESS!, abi: itemsAbi });

/** Comprueba que la dirección configurada sea de verdad un PolkaPetsItems ligado a este PolkaPets. */
export async function verificarItems(): Promise<void> {
  if (!ITEMS_ADDRESS) throw new Error("Los objetos NFT todavía no están desplegados.");
  let pets: string;
  try {
    pets = await publicClient.readContract({ address: ITEMS_ADDRESS, abi: itemsAbi, functionName: "pets" });
  } catch {
    throw new Error("La dirección de objetos no responde como PolkaPetsItems. Revisa ITEMS_ADDRESS.");
  }
  if (pets.toLowerCase() !== PETS_ADDRESS.toLowerCase()) {
    throw new Error("El contrato de objetos está ligado a otro PolkaPets. Despliégalo con la dirección correcta.");
  }
}

/** Ids del catálogo que esta mascota ya compró como NFT. */
export async function leerComprados(mascotaId: bigint): Promise<number[]> {
  if (!ITEMS_ADDRESS) return [];
  const ids = await publicClient.readContract({ address: ITEMS_ADDRESS, abi: itemsAbi, functionName: "compradosDe", args: [mascotaId] });
  return ids.map(Number);
}

export async function leerLegado(mascotaId: bigint): Promise<LegadoMascota | null> {
  if (!ITEMS_ADDRESS) return null;
  const l = await publicClient.readContract({ address: ITEMS_ADDRESS, abi: itemsAbi, functionName: "verLegado", args: [mascotaId] });
  return { sellado: l.sellado, duracion: Number(l.duracion), comprados: l.comprados.map(Number), equipados: l.equipados.map(Number), logros: l.logros.map(Number) };
}

/** Ids de logro que esta mascota ya reclamó como NFT. */
export async function leerLogros(mascotaId: bigint): Promise<number[]> {
  if (!ITEMS_ADDRESS) return [];
  const ids = await publicClient.readContract({ address: ITEMS_ADDRESS, abi: itemsAbi, functionName: "logrosDe", args: [mascotaId] });
  return ids.map(Number);
}

/** Firma el reclamo de un trofeo: el contrato comprueba tiempo y objetos y crea un NFT ligado a la mascota. */
export async function reclamarLogroMascota(firmante: Firmante, mascotaId: bigint, logroId: number, onPaso?: (p: PasoTx) => void): Promise<void> {
  await verificarItems();
  const token = await publicClient.readContract({ address: ITEMS_ADDRESS!, abi: itemsAbi, functionName: "tokenLogro", args: [mascotaId, logroId] });
  if (token !== 0n) throw new Error("LogroYaReclamado");
  await escribirLlamada(firmante, { functionName: "reclamarLogro", args: [mascotaId, logroId], destino: destino() }, onPaso);
}

/** Firma la compra de un objeto: el contrato crea un NFT ligado a esa mascota. */
export async function comprarArticulo(firmante: Firmante, mascotaId: bigint, articuloId: number, onPaso?: (p: PasoTx) => void): Promise<void> {
  await verificarItems();
  // El contrato v1 (52 objetos) no tiene la comida ni la ropa del cuerpo de v2 (53 en adelante).
  if (articuloId > ARTICULOS_V1 && (await versionItems()) < 2) throw new Error("SoloV2");
  const token = await publicClient.readContract({ address: ITEMS_ADDRESS!, abi: itemsAbi, functionName: "tokenComprado", args: [mascotaId, articuloId] });
  if (token !== 0n) throw new Error("YaComprado");
  await escribirLlamada(firmante, { functionName: "comprar", args: [mascotaId, articuloId], destino: destino() }, onPaso);
}

/**
 * Firma el legado de una mascota que murió: cuánto vivió y qué tenía puesto. El contrato vuelve a
 * validar las reglas (un accesorio, un mueble por categoría…) aunque la interfaz ya lo haya hecho.
 */
export async function sellarLegadoMascota(
  firmante: Firmante, mascotaId: bigint, duracionSeg: number, equipados: readonly number[], onPaso?: (p: PasoTx) => void,
): Promise<void> {
  await verificarItems();
  const actual = await leerLegado(mascotaId);
  if (actual?.sellado) throw new Error("LegadoYaSellado");
  const duracion = BigInt(Math.max(1, Math.floor(duracionSeg)));
  await escribirLlamada(firmante, { functionName: "sellarLegado", args: [mascotaId, duracion, equipados], destino: destino() }, onPaso);
}

/** Objetos del contrato v1 desplegado en TestNet (catálogo de Ana). */
export const ARTICULOS_V1 = 52;

let versionItemsCache: number | null = null;

/** 2 si ITEMS_ADDRESS es PolkaPetsItems v2 (comida, utilidad y drops); 1 si es el original; 0 si no hay. */
export async function versionItems(): Promise<number> {
  if (!ITEMS_ADDRESS) return 0;
  if (versionItemsCache !== null) return versionItemsCache;
  try {
    versionItemsCache = Number(await publicClient.readContract({ address: ITEMS_ADDRESS, abi: itemsAbi, functionName: "version" }));
  } catch (e) {
    if (!(e instanceof ContractFunctionExecutionError)) throw e;
    versionItemsCache = 1;
  }
  return versionItemsCache;
}

/** Comida NFT sin usar de una mascota: tokenId y artículo del catálogo. */
export async function leerDespensa(mascotaId: bigint): Promise<Array<{ tokenId: bigint; articulo: number }>> {
  if ((await versionItems()) < 2) return [];
  const [tokens, articulos] = await publicClient.readContract({ address: ITEMS_ADDRESS!, abi: itemsAbi, functionName: "despensaDe", args: [mascotaId] });
  return tokens.map((tokenId, i) => ({ tokenId, articulo: Number(articulos[i]) }));
}

export async function leerDropsDisponibles(mascotaId: bigint): Promise<number> {
  if ((await versionItems()) < 2) return 0;
  return Number(await publicClient.readContract({ address: ITEMS_ADDRESS!, abi: itemsAbi, functionName: "dropsDisponibles", args: [mascotaId] }));
}

/** Firma `usar`: quema la comida NFT y cura a la mascota en PolkaPets. */
export async function usarComida(firmante: Firmante, tokenId: bigint, onPaso?: (p: PasoTx) => void): Promise<void> {
  await verificarItems();
  await escribirLlamada(firmante, { functionName: "usar", args: [tokenId], destino: destino() }, onPaso);
}

/**
 * Firma `reclamarDrop` y devuelve el artículo que salió (la comida nueva de la despensa).
 * El contrato elige la comida; se lee comparando la despensa antes y después.
 */
export async function reclamarDropMascota(firmante: Firmante, mascotaId: bigint, onPaso?: (p: PasoTx) => void): Promise<{ tokenId: bigint; articulo: number } | null> {
  await verificarItems();
  const antes = new Set((await leerDespensa(mascotaId)).map((d) => String(d.tokenId)));
  await escribirLlamada(firmante, { functionName: "reclamarDrop", args: [mascotaId], destino: destino() }, onPaso);
  onPaso?.("leyendo");
  for (let intento = 0; intento < 4; intento++) {
    if (intento > 0) await new Promise((r) => setTimeout(r, 1_500));
    const nuevo = (await leerDespensa(mascotaId)).find((d) => !antes.has(String(d.tokenId)));
    if (nuevo) return nuevo;
  }
  return null;
}

/** Admin: intervalo de drops (solo el dueño del contrato puede cambiarlo). */
export async function leerAdminItems(): Promise<{ owner: string; intervaloDrop: number } | null> {
  if ((await versionItems()) < 2) return null;
  const [owner, intervalo] = await Promise.all([
    publicClient.readContract({ address: ITEMS_ADDRESS!, abi: itemsAbi, functionName: "owner" }),
    publicClient.readContract({ address: ITEMS_ADDRESS!, abi: itemsAbi, functionName: "intervaloDrop" }),
  ]);
  return { owner, intervaloDrop: Number(intervalo) };
}

export async function cambiarIntervaloDrop(firmante: Firmante, segundos: number, onPaso?: (p: PasoTx) => void): Promise<void> {
  await escribirLlamada(firmante, { functionName: "setIntervaloDrop", args: [BigInt(Math.floor(segundos))], destino: destino() }, onPaso);
}

/** Mensaje en español para los errores propios de los objetos; null si no es uno de ellos. */
export function errorItems(e: unknown): string | null {
  if (e instanceof Error && e.message === "SoloV2") return "Este objeto llega con los contratos v2; todavía no está en TestNet.";
  if (e instanceof Error && e.message === "YaComprado") return "Esta mascota ya compró ese objeto.";
  if (e instanceof Error && e.message === "LogroYaReclamado") return "Esta mascota ya reclamó ese trofeo.";
  if (e instanceof Error && e.message === "LegadoYaSellado") return "El legado de esta mascota ya está guardado.";
  if (!(e instanceof BaseError)) return null;
  const revert = e.walk((x) => x instanceof ContractFunctionRevertedError);
  const name = revert instanceof ContractFunctionRevertedError ? revert.data?.errorName : undefined;
  switch (name) {
    case "NoEresDueno": return "Esa cuenta no es dueña del NFT de esta mascota. Conecta la cuenta con la que la adoptaste.";
    case "MascotaMuerta": return "Tu mascota ya murió en la blockchain: no se pueden comprar más objetos para ella.";
    case "LegadoYaSellado": return "El legado de esta mascota ya está guardado: no se pueden comprar más objetos para ella.";
    case "ArticuloInvalido": return "Ese objeto no existe en el contrato.";
    case "SoloPorLogro": return "Ese objeto no se compra: se gana reclamando un trofeo.";
    case "YaComprado": return "Esta mascota ya compró ese objeto.";
    case "NoComprado": return "Tienes puesto un objeto que esta mascota no compró como NFT.";
    case "LugarRepetido": return "No se puede tener dos accesorios, dos paredes o dos pisos al mismo tiempo.";
    case "CategoriaRepetida": return "No se puede tener dos muebles o adornos de la misma categoría al mismo tiempo.";
    case "SinLugar": return "No hay más lugares libres en la habitación para eso.";
    case "LogroInvalido": return "Ese trofeo no existe en el contrato.";
    case "LogroYaReclamado": return "Esta mascota ya reclamó ese trofeo.";
    case "LogroNoAlcanzado": return "Todavía no cumples lo necesario para ese trofeo en la blockchain (tiempo desde la adopción u objetos comprados).";
    case "DuracionInvalida": return "La duración no es válida para este NFT (no puede ser mayor que el tiempo desde que lo adoptaste).";
    case "NoTransferible": return "Los objetos quedan ligados a su mascota y no se pueden transferir.";
    case "NoEsComida": return "Ese objeto no es una comida de la despensa (o ya se usó).";
    case "SinDrops": return "Todavía no hay un drop para reclamar. Sigue cuidándola.";
    case "NoSePonen": return "La comida no se pone: se usa desde la despensa.";
    case "OwnableUnauthorizedAccount": return "Solo la cuenta administradora del contrato puede hacer eso.";
    default: return null;
  }
}
