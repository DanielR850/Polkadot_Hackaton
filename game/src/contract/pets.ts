// Cliente de red. Lecturas por el ETH-RPC público; escrituras firmadas por la wallet elegida.
// Antes de pedir una firma se simula la llamada: si el contrato la rechazaría, no se molesta al usuario.
import { createPublicClient, createWalletClient, custom, defineChain, http, type Address, type Hex } from "viem";
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

type Escritura =
  | { functionName: "mint"; args: [string, number] }
  | { functionName: "cambiarNombre"; args: [bigint, string] }
  | { functionName: Accion; args: [bigint] };

/** Simula, pide la firma y espera el recibo. Devuelve el hash. */
async function escribir(provider: Eip1193Provider, cuenta: Address, llamada: Escritura): Promise<Hex> {
  await asegurarRed(provider);
  const { request } = await publicClient.simulateContract({ ...contrato, ...llamada, account: cuenta } as never);
  const wallet = createWalletClient({ account: cuenta, chain: polkadotHub, transport: custom(provider) });
  const hash = await wallet.writeContract(request as never);
  const recibo = await publicClient.waitForTransactionReceipt({ hash, timeout: TX_TIMEOUT_MS });
  if (recibo.status !== "success") throw new Error("La transacción se revirtió en la cadena.");
  return hash;
}

/** Adopta una mascota. Devuelve el tokenId nuevo. */
export async function adoptar(provider: Eip1193Provider, cuenta: Address, nombre: string, especie: number): Promise<bigint> {
  const antes = new Set((await mascotasDe(cuenta)).map(String));
  await escribir(provider, cuenta, { functionName: "mint", args: [nombre.trim(), especie] });
  const despues = await mascotasDe(cuenta);
  const nueva = despues.filter((id) => !antes.has(String(id))).sort((a, b) => (a > b ? -1 : 1))[0];
  if (nueva === undefined) throw new Error("La mascota se creó, pero todavía no aparece. Recarga en unos segundos.");
  return nueva;
}

export async function cuidar(provider: Eip1193Provider, cuenta: Address, accion: Accion, tokenId: bigint): Promise<void> {
  await escribir(provider, cuenta, { functionName: accion, args: [tokenId] });
}

export async function cambiarNombre(provider: Eip1193Provider, cuenta: Address, tokenId: bigint, nombre: string): Promise<void> {
  await escribir(provider, cuenta, { functionName: "cambiarNombre", args: [tokenId, nombre.trim()] });
}
