// Cliente del contrato PolkaPetsPagos: la wallet de cobro de cada jugador y los premios pagados
// (con el hash de cada pago), como en el Pac-Man del taller. Lecturas por ETH-RPC; escrituras firmadas
// por la misma sesión que el resto (pets.ts). El contrato no mueve dinero: solo guarda el registro.
import { BaseError, ContractFunctionRevertedError, isAddress, parseAbi, type Address, type Hex } from "viem";
import { EXPLORER_URL, PAGOS_ADDRESS } from "./config";
import { escribirLlamada, publicClient, type Firmante, type PasoTx } from "./pets";

export const pagosAbi = parseAbi([
  "function setBilletera(address billetera)",
  "function registrarPago(uint32 semana, uint8 lugar, address cuenta, uint64 monto, bytes32 txHash)",
  "function billeteraDe(address cuenta) view returns (address)",
  "function billeterasDe(address[] cuentas) view returns (address[])",
  "function totalPagos() view returns (uint256)",
  "function pago(uint256 indice) view returns ((address cuenta, address billetera, uint32 semana, uint8 lugar, uint64 monto, bytes32 txHash, uint64 pagadoEn))",
  "function pagosDe(address cuenta) view returns ((address cuenta, address billetera, uint32 semana, uint8 lugar, uint64 monto, bytes32 txHash, uint64 pagadoEn)[])",
  "function pagosDeSemana(uint32 semana) view returns ((address cuenta, address billetera, uint32 semana, uint8 lugar, uint64 monto, bytes32 txHash, uint64 pagadoEn)[])",
  "function owner() view returns (address)",
  "error SinBilletera(address cuenta)",
  "error LugarInvalido(uint8 lugar)",
  "error PagoYaRegistrado(uint32 semana, uint8 lugar)",
  "error MontoInvalido()",
  "error TxInvalido()",
  "error NoExistePago(uint256 indice)",
  "error OwnableUnauthorizedAccount(address account)",
]);

/** Un premio pagado. */
export interface PagoRegistrado {
  cuenta: Address;
  billetera: Address;
  semana: number;
  /** 1, 2 o 3. */
  lugar: number;
  /** Monto pagado (dólares enteros). */
  monto: number;
  txHash: Hex;
  /** Momento del registro (segundos Unix). */
  pagadoEn: number;
}

/** true si hay contrato de pagos configurado. */
export const pagosActivo = (): boolean => PAGOS_ADDRESS !== null;

const destino = () => ({ address: PAGOS_ADDRESS!, abi: pagosAbi });
const CERO = "0x0000000000000000000000000000000000000000";

type PagoRaw = { cuenta: Address; billetera: Address; semana: number; lugar: number; monto: bigint; txHash: Hex; pagadoEn: bigint };
const decodificar = (p: PagoRaw): PagoRegistrado => ({
  cuenta: p.cuenta, billetera: p.billetera, semana: Number(p.semana), lugar: Number(p.lugar), monto: Number(p.monto), txHash: p.txHash, pagadoEn: Number(p.pagadoEn),
});

/** Enlace al explorador para revisar la transacción de un pago. */
export const enlaceDelPago = (txHash: string): string => `${EXPLORER_URL}/tx/${txHash}`;

/** La wallet de cobro que esta cuenta registró en la cadena, o null si no ha registrado ninguna. */
export async function leerBilletera(cuenta: Address): Promise<Address | null> {
  if (!PAGOS_ADDRESS) return null;
  const b = await publicClient.readContract({ address: PAGOS_ADDRESS, abi: pagosAbi, functionName: "billeteraDe", args: [cuenta] });
  return b === CERO ? null : b;
}

/** Firma el registro (o cambio) de la wallet de cobro. El contrato simula la llamada antes de pedir la firma. */
export async function guardarBilletera(firmante: Firmante, billetera: string, onPaso?: (p: PasoTx) => void): Promise<void> {
  if (!PAGOS_ADDRESS) throw new Error("Los pagos todavía no están desplegados.");
  if (!isAddress(billetera)) throw new Error("BilleteraInvalida");
  await escribirLlamada(firmante, { functionName: "setBilletera", args: [billetera as Address], destino: destino() }, onPaso);
}

/** Pagos que ha recibido una cuenta (de lo más viejo a lo más nuevo). */
export async function leerPagosDe(cuenta: Address): Promise<PagoRegistrado[]> {
  if (!PAGOS_ADDRESS) return [];
  const lista = await publicClient.readContract({ address: PAGOS_ADDRESS, abi: pagosAbi, functionName: "pagosDe", args: [cuenta] });
  return (lista as readonly PagoRaw[]).map(decodificar);
}

/** Los tres lugares de una semana; los que aún no se pagan no aparecen. */
export async function leerPagosSemana(semana: number): Promise<PagoRegistrado[]> {
  if (!PAGOS_ADDRESS) return [];
  const lista = await publicClient.readContract({ address: PAGOS_ADDRESS, abi: pagosAbi, functionName: "pagosDeSemana", args: [semana] });
  return (lista as readonly PagoRaw[]).map(decodificar).filter((p) => p.pagadoEn > 0);
}

/** Cuántos pagos hay registrados en total. */
export async function totalPagos(): Promise<number> {
  if (!PAGOS_ADDRESS) return 0;
  return Number(await publicClient.readContract({ address: PAGOS_ADDRESS, abi: pagosAbi, functionName: "totalPagos" }));
}

/** Los últimos `n` pagos, del más nuevo al más viejo. */
export async function leerUltimosPagos(n = 10): Promise<PagoRegistrado[]> {
  if (!PAGOS_ADDRESS) return [];
  const total = await totalPagos();
  const indices = Array.from({ length: Math.min(n, total) }, (_, i) => total - 1 - i);
  const lista = await Promise.all(indices.map((i) => publicClient.readContract({ address: PAGOS_ADDRESS!, abi: pagosAbi, functionName: "pago", args: [BigInt(i)] })));
  return (lista as readonly PagoRaw[]).map(decodificar);
}

/** Quién administra los pagos (puede registrar un pago hecho). */
export async function leerAdminPagos(): Promise<Address | null> {
  if (!PAGOS_ADDRESS) return null;
  return publicClient.readContract({ address: PAGOS_ADDRESS, abi: pagosAbi, functionName: "owner" });
}

/** Admin: anota un premio ya pagado, con el hash de la transacción del envío. */
export async function registrarPagoHecho(
  firmante: Firmante, p: { semana: number; lugar: number; cuenta: string; monto: number; txHash: string }, onPaso?: (p: PasoTx) => void,
): Promise<void> {
  if (!PAGOS_ADDRESS) throw new Error("Los pagos todavía no están desplegados.");
  if (!isAddress(p.cuenta)) throw new Error("BilleteraInvalida");
  if (!/^0x[0-9a-fA-F]{64}$/.test(p.txHash)) throw new Error("TxInvalido");
  await escribirLlamada(
    firmante,
    { functionName: "registrarPago", args: [p.semana, p.lugar, p.cuenta as Address, BigInt(p.monto), p.txHash as Hex], destino: destino() },
    onPaso,
  );
}

/** Mensaje en español para los errores de los pagos; null si no es uno de ellos. */
export function errorPagos(e: unknown): string | null {
  if (e instanceof Error && e.message === "BilleteraInvalida") return "Esa dirección no es válida. Debe empezar con 0x y tener 40 caracteres después.";
  if (e instanceof Error && e.message === "TxInvalido") return "El hash del pago debe empezar con 0x y tener 64 caracteres después.";
  if (!(e instanceof BaseError)) return null;
  const revert = e.walk((x) => x instanceof ContractFunctionRevertedError);
  const name = revert instanceof ContractFunctionRevertedError ? revert.data?.errorName : undefined;
  switch (name) {
    case "SinBilletera": return "Esa cuenta todavía no registró su wallet de cobro: no se le puede anotar el pago.";
    case "LugarInvalido": return "El lugar del premio debe ser 1, 2 o 3.";
    case "PagoYaRegistrado": return "Ese premio ya está registrado como pagado.";
    case "MontoInvalido": return "El monto debe ser mayor que 0.";
    case "TxInvalido": return "El hash del pago no es válido.";
    case "OwnableUnauthorizedAccount": return "Solo la cuenta administradora de los pagos puede anotar un pago.";
    default: return null;
  }
}
