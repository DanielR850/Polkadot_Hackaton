/*
 * Adaptador del Host de Polkadot (Polkadot Desktop o la Polkadot App) con el Product SDK 0.39.0.
 * Sigue la app de referencia del taller Products Devnet (polkadot-devnet-workshop, game/src/hub/hub.ts).
 *
 * - Dentro del Host la cuenta la entrega el Host: es una cuenta derivada de `polka-pets.dot`,
 *   distinta de la de MetaMask.
 * - Las firmas pasan por el Host y se aprueban en el teléfono. Una a la vez.
 * - Las lecturas siguen por ETH-RPC (contract/pets.ts); aquí solo se escribe.
 * - El SDK se carga con import() para que el modo navegador/MetaMask no lo descargue antes de tiempo.
 */
import type { Address } from "viem";
import type * as ContractsSdk from "@parity/product-sdk/contracts";
import type * as WalletSdk from "@parity/product-sdk/wallet";
import {
  DERIVATION_INDEX,
  HOST_ALLOWANCE_TIMEOUT_MS,
  HOST_CONNECT_TIMEOUT_MS,
  HOST_SIGN_TIMEOUT_MS,
  PETS_ADDRESS,
  PRODUCT_CONTEXT_TIMEOUT_MS,
  PRODUCT_DOMAIN,
  READ_TIMEOUT_MS,
} from "./config";
import abiJson from "./polkapets.abi.json";

export interface CuentaHost {
  /** Dirección 0x… que ve el contrato como msg.sender. */
  h160: Address;
  /** La misma cuenta en SS58, la que firma en el Host. */
  ss58: string;
}

export interface LlamadaHost {
  functionName: string;
  args: readonly unknown[];
}

export interface SesionHost {
  cuenta: CuentaHost;
  /** Firma y envía la llamada; resuelve cuando la transacción se finaliza. Lanza si falla. */
  enviar(llamada: LlamadaHost, onPaso?: (p: "firma" | "confirmando") => void): Promise<void>;
  destruir(): void;
}

type Permiso = "Allocated" | "Rejected" | "NotAvailable";

const abi = abiJson as unknown as ContractsSdk.AbiEntry[];
const host = () => import("@parity/product-sdk/host");

/* ---------------------------------------------------------------- ayudas */

function conPlazo<T>(promesa: Promise<T>, ms: number, etiqueta: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${etiqueta}: sin respuesta en ${Math.round(ms / 1000)} s`)), ms);
    promesa.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** Texto de cualquier error del SDK (a veces son objetos, no Error). */
export function textoError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error, (_k, v) => (typeof v === "bigint" ? v.toString() : v)) ?? String(error);
  } catch {
    return String(error);
  }
}

const PAGO = /Invalid\.?\s*Payment/i;
const SESION = /Invalid\.?\s*(Stale|Future|AncientBirthBlock|BadProof|BadSigner)|\bnonce\b|outdated/i;
const CONEXION = /disconnect|not connected|websocket|socket|Host provider|connection (closed|lost)|ECONN/i;

/**
 * El id con el que el Host deriva cuentas, deducido de la URL cuando el Host no lo dice.
 * `<n>.dot`, `<n>.dot.li`, `<n>.app.dot.li`, `<n>.dev-dot.li` y `<n>.app.dev-dot.li` → `<n>.dot`.
 */
export function productIdFromHost(hostname: string): string {
  const h = hostname.toLowerCase();
  if (/^localhost(:\d{1,5})?$/.test(h) || h.endsWith(".dot")) return h;
  const label = /^([a-z0-9-]+)\.(?:app\.)?(?:dev-)?dot\.li$/.exec(h)?.[1];
  return label ? `${label}.dot` : PRODUCT_DOMAIN;
}

/* --------------------------------------------------------------- detección */

let dentro: Promise<boolean> | null = null;

/** true si la app corre dentro de Polkadot Desktop o la Polkadot App. Nunca lanza. */
export function dentroDelHost(): Promise<boolean> {
  dentro ??= host()
    .then(async (h) => Boolean(await h.isInsideContainer()))
    .catch((e: unknown) => {
      console.warn("[polkapets] isInsideContainer", textoError(e));
      return false;
    });
  return dentro;
}

/* ------------------------------------------------------------------ cadena */

interface Cadena {
  runtime: ContractsSdk.ContractRuntime;
  contracts: typeof ContractsSdk;
  destroy(): void;
}

async function abrirCadena(): Promise<Cadena> {
  const [{ createChainClient }, contracts, { devnet_asset_hub }] = await Promise.all([
    import("@parity/product-sdk/chain"),
    import("@parity/product-sdk/contracts"),
    import("@parity/product-sdk-descriptors/devnet-asset-hub"),
  ]);
  const client = await createChainClient({ chains: { assetHub: devnet_asset_hub } });
  const runtime = contracts.createContractRuntimeFromClient(client.raw.assetHub, devnet_asset_hub, { at: "best" });
  try {
    await conPlazo(client.assetHub.query.System.Number.getValue({ at: "best" }), READ_TIMEOUT_MS, "Bloque de Asset Hub");
  } catch (e) {
    client.destroy();
    throw e;
  }
  return { runtime, contracts, destroy: () => client.destroy() };
}

/* ------------------------------------------------------------------ cuenta */

interface Firma {
  manager: WalletSdk.SignerManager;
  cuenta: WalletSdk.SignerAccount;
}

async function abrirFirma(productId: string): Promise<Firma> {
  const { SignerManager } = await import("@parity/product-sdk/wallet");
  const manager = new SignerManager({
    dappName: productId,
    ss58Prefix: 42,
    hostTimeout: 30_000,
    maxRetries: 1,
    persistence: null,
  });
  try {
    const conectado = await conPlazo(manager.connect(), HOST_CONNECT_TIMEOUT_MS, "Conexión de firma");
    if (!conectado.ok) throw conectado.error;
    const cuenta = await conPlazo(manager.getProductAccount(productId, DERIVATION_INDEX), HOST_CONNECT_TIMEOUT_MS, "Cuenta del Product");
    if (!cuenta.ok) throw cuenta.error;
    return { manager, cuenta: cuenta.value };
  } catch (e) {
    manager.destroy();
    throw e;
  }
}

async function idDelProduct(): Promise<string> {
  const h = await host();
  const truApi = await h.getTruApi();
  if (!truApi) throw new Error("La Polkadot App no expone la conexión con la app (TrUAPI).");
  try {
    const contexto = await conPlazo(
      Promise.resolve(
        truApi.system.getProductContext().match(
          (v) => v,
          (e) => {
            throw new Error(textoError(e));
          },
        ),
      ),
      PRODUCT_CONTEXT_TIMEOUT_MS,
      "getProductContext",
    );
    return contexto.productId;
  } catch (e) {
    const id = productIdFromHost(location.host);
    console.info("[polkapets] getProductContext no respondió; id deducido de la URL", id, textoError(e));
    return id;
  }
}

/** Permiso de gas (PGAS) para la cuenta del Product. */
async function pedirGas(): Promise<Permiso> {
  try {
    const r = await conPlazo(
      (await host()).requestResourceAllocation([
        { tag: "SmartContractAllowance", value: { tag: "Index", value: DERIVATION_INDEX } },
      ]),
      HOST_ALLOWANCE_TIMEOUT_MS,
      "Permiso de gas",
    );
    if (!r.ok) {
      console.warn("[polkapets] requestResourceAllocation", textoError(r.error));
      return "NotAvailable";
    }
    const resultado = r.value[0];
    return resultado === "Allocated" || resultado === "Rejected" ? resultado : "NotAvailable";
  } catch (e) {
    console.warn("[polkapets] permiso de gas", textoError(e));
    return "NotAvailable";
  }
}

/* ------------------------------------------------------------------ sesión */

type ContratoSdk = Record<
  string,
  { tx: (...args: unknown[]) => Promise<{ ok: true } | { ok: false; error: unknown }> }
>;

/**
 * Conecta con el Host: pide la cuenta (identidad + enviar transacciones) y el permiso de gas.
 * Lanza si la persona rechaza o el Host no responde.
 */
export async function conectarHost(): Promise<SesionHost> {
  const productId = await idDelProduct();
  let cadena = await abrirCadena();
  let firma: Firma;
  try {
    firma = await abrirFirma(productId);
  } catch (e) {
    cadena.destroy();
    throw e;
  }

  const permiso = await pedirGas();
  if (permiso === "Rejected") {
    firma.manager.destroy();
    cadena.destroy();
    throw new Error("Rechazaste el permiso de gas. Sin él no puedes adoptar ni cuidar a tu mascota.");
  }

  let mapeada = false;

  const contrato = (): ContratoSdk =>
    cadena.contracts.createContract(cadena.runtime, PETS_ADDRESS, abi, {
      defaultOrigin: firma.cuenta.address,
      defaultSigner: firma.cuenta.getSigner(),
    }) as unknown as ContratoSdk;

  /** pallet-revive exige que la cuenta SS58 esté vinculada a su 0x… antes de llamar contratos. */
  const asegurarMapeo = async () => {
    if (mapeada) return;
    const r = await cadena.contracts.isContractAccountMapped(cadena.runtime, firma.cuenta.address);
    if (r.ok && r.value) {
      mapeada = true;
      return;
    }
    const m = await cadena.contracts.ensureContractAccountMapped(cadena.runtime, firma.cuenta.address, firma.cuenta.getSigner(), {
      timeoutMs: HOST_SIGN_TIMEOUT_MS,
    });
    if (!m.ok) throw m.error;
    mapeada = true;
  };

  /** Cadena y firma nuevas, sin volver a pedir el gas. */
  const reconectar = async () => {
    cadena.destroy();
    firma.manager.destroy();
    cadena = await abrirCadena();
    firma = await abrirFirma(productId);
  };

  const intentar = async ({ functionName, args }: LlamadaHost, onPaso?: (p: "firma" | "confirmando") => void) => {
    onPaso?.("firma");
    await asegurarMapeo();
    const metodo = contrato()[functionName];
    if (!metodo) throw new Error(`El contrato no tiene la función ${functionName}.`);
    // El SDK avisa signing → broadcasting → in-block → finalized.
    const onStatus = (status: unknown) => {
      const s = typeof status === "string" ? status : String((status as { type?: unknown } | null)?.type ?? "");
      if (s === "broadcasting" || s === "in-block" || s === "finalized") onPaso?.("confirmando");
    };
    const r = await metodo.tx(...args, { waitFor: "finalized", timeoutMs: HOST_SIGN_TIMEOUT_MS, onStatus });
    if (!r.ok) throw r.error;
  };

  let enCurso = false;

  return {
    cuenta: { h160: firma.cuenta.h160Address as Address, ss58: firma.cuenta.address },

    async enviar(llamada, onPaso) {
      if (enCurso) throw new Error("Espera a que termine la firma en curso.");
      enCurso = true;
      try {
        try {
          await intentar(llamada, onPaso);
        } catch (e) {
          const t = textoError(e);
          console.warn("[polkapets] tx Host", t);
          // Una sola recuperación automática, como la app de referencia.
          if (PAGO.test(t)) {
            if ((await pedirGas()) === "Rejected") throw e;
          } else if (SESION.test(t) || CONEXION.test(t)) {
            await reconectar();
          } else {
            throw e;
          }
          await intentar(llamada, onPaso);
        }
      } finally {
        enCurso = false;
      }
    },

    destruir() {
      firma.manager.destroy();
      cadena.destroy();
    },
  };
}
