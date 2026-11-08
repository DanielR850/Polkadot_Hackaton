// Cliente de red. Lecturas por el ETH-RPC público; escrituras firmadas por la wallet elegida
// (MetaMask en un navegador normal, o el Host de Polkadot dentro de la Polkadot App/Desktop).
// Antes de pedir una firma se simula la llamada: si el contrato la rechazaría, no se molesta al usuario.
import { createPublicClient, createWalletClient, custom, defineChain, http, type Abi, type Address, type Hex } from "viem";
import {
  CHAIN_ID,
  CHAIN_NAME,
  ETH_RPC_URL,
  EXPLORER_URL,
  NATIVE_DECIMALS,
  NATIVE_SYMBOL,
  PETS_ADDRESS,
  RANKING_PAGINA,
  RANKING_MAX_LEER,
  READ_TIMEOUT_MS,
  TX_TIMEOUT_MS,
} from "./config";
import { decodeMascota, decodeRanking, polkaPetsAbi, type Accion, type FilaRanking, type Mascota } from "./polkapets";
import type { SesionHost } from "./host";
import type { Eip1193Provider } from "./wallets";

export const polkadotHub = defineChain({
  id: CHAIN_ID,
  name: CHAIN_NAME,
  nativeCurrency: { name: NATIVE_SYMBOL, symbol: NATIVE_SYMBOL, decimals: NATIVE_DECIMALS },
  rpcUrls: { default: { http: [ETH_RPC_URL] } },
  blockExplorers: { default: { name: "Blockscout", url: EXPLORER_URL } },
});

export const publicClient = createPublicClient({
  chain: polkadotHub,
  transport: http(ETH_RPC_URL, { timeout: READ_TIMEOUT_MS }),
});

const contrato = { address: PETS_ADDRESS, abi: polkaPetsAbi } as const;

// ───────────────────────────────────────────────────────────── cuenta

/** Pide acceso a la cuenta y deja la wallet en Polkadot Hub. */
export async function conectar(provider: Eip1193Provider): Promise<Address> {
  const cuentas = (await provider.request({ method: "eth_requestAccounts" })) as Address[];
  if (!cuentas?.length) throw new Error("La wallet no compartió ninguna cuenta.");
  await asegurarRed(provider);
  return cuentas[0];
}

/** Cuenta ya autorizada, sin abrir la wallet. */
export async function cuentaAutorizada(provider: Eip1193Provider): Promise<Address | null> {
  const cuentas = (await provider.request({ method: "eth_accounts" })) as Address[];
  return cuentas?.length ? cuentas[0] : null;
}

const CHAIN_HEX = `0x${CHAIN_ID.toString(16)}`;

async function asegurarRed(provider: Eip1193Provider): Promise<void> {
  const actual = String(await provider.request({ method: "eth_chainId" })).toLowerCase();
  if (actual === CHAIN_HEX) return;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
  } catch (e) {
    // 4902: la wallet no conoce la red. Se agrega (y la wallet cambia a ella).
    if ((e as { code?: number }).code !== 4902) throw e;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: CHAIN_HEX,
          chainName: CHAIN_NAME,
          nativeCurrency: { name: NATIVE_SYMBOL, symbol: NATIVE_SYMBOL, decimals: NATIVE_DECIMALS },
          rpcUrls: [ETH_RPC_URL],
          blockExplorerUrls: [EXPLORER_URL],
        },
      ],
    });
  }
}

export async function saldo(cuenta: Address): Promise<bigint> {
  return publicClient.getBalance({ address: cuenta });
}

/** Límite del contrato realmente desplegado; puede ser distinto al Solidity de esta rama. */
export async function numEspecies(): Promise<number> {
  return Number(await publicClient.readContract({ ...contrato, functionName: "NUM_ESPECIES" }));
}

// ───────────────────────────────────────────────────────────── lecturas

export async function mascotasDe(dueno: Address): Promise<bigint[]> {
  const ids = (await publicClient.readContract({ ...contrato, functionName: "mascotasDe", args: [dueno] })) as readonly bigint[];
  return [...ids];
}

export async function verMascota(tokenId: bigint): Promise<Mascota> {
  return decodeMascota(await publicClient.readContract({ ...contrato, functionName: "verMascota", args: [tokenId] }));
}

/** Todas las mascotas de la cuenta, de la más nueva a la más vieja. */
export async function cargarMascotas(dueno: Address): Promise<Mascota[]> {
  const ids = await mascotasDe(dueno);
  const lista = await Promise.all(ids.map((id) => verMascota(id)));
  return lista.sort((a, b) => (a.tokenId > b.tokenId ? -1 : 1));
}

/** Todas las filas del ranking (sin ordenar), leídas en páginas. */
export async function leerRanking(): Promise<FilaRanking[]> {
  const total = Number(await publicClient.readContract({ ...contrato, functionName: "totalMascotas" }));
  const hasta = Math.min(total, RANKING_MAX_LEER);
  const paginas: Promise<unknown>[] = [];
  for (let desde = 0; desde < hasta; desde += RANKING_PAGINA) {
    const cantidad = Math.min(RANKING_PAGINA, hasta - desde);
    paginas.push(publicClient.readContract({ ...contrato, functionName: "ranking", args: [BigInt(desde), BigInt(cantidad)] }));
  }
  return (await Promise.all(paginas)).flatMap(decodeRanking);
}

// ───────────────────────────────────────────────────────────── escrituras

/** Otro contrato al que se le firma (el ranking). Sin destino, la llamada va a PolkaPets. */
export interface Destino { address: Address; abi: Abi }

export type Escritura = (
  | { functionName: "mint"; args: [string, number] }
  | { functionName: "cambiarNombre"; args: [bigint, string] }
  | { functionName: Accion; args: [bigint] }
  | { functionName: "registrarMuerte"; args: [bigint, string, number, bigint] }
) & { destino?: Destino };

/** Contrato y argumentos para viem (simular o enviar). */
const objetivo = ({ destino, ...llamada }: Escritura) => ({ address: destino?.address ?? PETS_ADDRESS, abi: destino?.abi ?? polkaPetsAbi, ...llamada });

/** Paso visible de una escritura, para mostrar el progreso mientras la persona firma. */
export type PasoTx = "simulando" | "firma" | "confirmando" | "leyendo";

/** Quien firma: una wallet EVM del navegador (MetaMask…) o el Host de Polkadot. */
export interface Firmante {
  tipo: "evm" | "host";
  nombre: string;
  cuenta: Address;
  /** Firma y envía una llamada ya simulada. Resuelve cuando entra en la cadena. */
  enviar(llamada: Escritura, onPaso?: (p: PasoTx) => void): Promise<void>;
}

export function firmanteEvm(nombre: string, provider: Eip1193Provider, cuenta: Address): Firmante {
  return {
    tipo: "evm",
    nombre,
    cuenta,
    async enviar(llamada, onPaso) {
      await asegurarRed(provider);
      const { request } = await publicClient.simulateContract({ ...objetivo(llamada), account: cuenta } as never);
      const wallet = createWalletClient({ account: cuenta, chain: polkadotHub, transport: custom(provider) });
      onPaso?.("firma");
      const hash: Hex = await wallet.writeContract(request as never);
      onPaso?.("confirmando");
      const recibo = await publicClient.waitForTransactionReceipt({ hash, timeout: TX_TIMEOUT_MS });
      if (recibo.status !== "success") throw new Error("La transacción se revirtió en la cadena.");
    },
  };
}

export function firmanteHost(sesion: SesionHost): Firmante {
  return {
    tipo: "host",
    nombre: "Polkadot App",
    cuenta: sesion.cuenta.h160,
    enviar: (llamada, onPaso) => sesion.enviar(llamada, onPaso),
  };
}

/** Simula por ETH-RPC (si el contrato la rechazaría, no se pide firma) y después firma. */
async function escribir(firmante: Firmante, llamada: Escritura, onPaso?: (p: PasoTx) => void): Promise<void> {
  onPaso?.("simulando");
  await publicClient.simulateContract({ ...objetivo(llamada), account: firmante.cuenta } as never);
  await firmante.enviar(llamada, onPaso);
}

/** Igual que escribir, para otros módulos del cliente (ranking). */
export const escribirLlamada = escribir;

/** Adopta una mascota. Devuelve el tokenId nuevo. */
export async function adoptar(firmante: Firmante, nombre: string, especie: number, onPaso?: (p: PasoTx) => void): Promise<bigint> {
  const cuenta = firmante.cuenta;
  const antes = new Set((await mascotasDe(cuenta)).map(String));
  await escribir(firmante, { functionName: "mint", args: [nombre.trim(), especie] }, onPaso);
  onPaso?.("leyendo");
  // El ETH-RPC puede ir un bloque atrás: se relee unas veces antes de rendirse.
  for (let intento = 0; intento < 4; intento++) {
    if (intento > 0) await new Promise((r) => setTimeout(r, 2_000));
    const despues = await mascotasDe(cuenta);
    const nueva = despues.filter((id) => !antes.has(String(id))).sort((a, b) => (a > b ? -1 : 1))[0];
    if (nueva !== undefined) return nueva;
  }
  throw new Error("La mascota se creó, pero todavía no aparece. Recarga en unos segundos.");
}

export async function cuidar(firmante: Firmante, accion: Accion, tokenId: bigint, onPaso?: (p: PasoTx) => void): Promise<void> {
  await escribir(firmante, { functionName: accion, args: [tokenId] }, onPaso);
}

export async function cambiarNombre(firmante: Firmante, tokenId: bigint, nombre: string, onPaso?: (p: PasoTx) => void): Promise<void> {
  await escribir(firmante, { functionName: "cambiarNombre", args: [tokenId, nombre.trim()] }, onPaso);
}
