// Traduce errores de wallet, red y contrato a mensajes cortos para el jugador.
import { BaseError, ContractFunctionRevertedError } from "viem";

/** Errores personalizados de PolkaPets.sol. */
export function textoRevert(errorName: string): string {
  switch (errorName) {
    case "EstaMuerta":
      return "Tu mascota ya murió. Empieza una partida nueva.";
    case "NoEresDueno":
      return "Esta mascota no es de tu cuenta.";
    case "NoExiste":
      return "Esa mascota no existe.";
    case "NombreInvalido":
      return "El nombre debe tener entre 1 y 24 caracteres.";
    case "EspecieInvalida":
      return "Esa mascota no existe en el juego.";
    default:
      return `El contrato rechazó la operación (${errorName}).`;
  }
}

/** Mensajes reconocibles en errores que no vienen del contrato. */
export function textoGenerico(mensaje: string, codigo?: unknown): string {
  const m = mensaje.toLowerCase();
  // Errores del Host de Polkadot (Product SDK).
  if (/invalid\.?\s*payment/i.test(mensaje)) {
    return "Tu cuenta no tiene gas (PGAS). Toca Salir, vuelve a conectar y acepta el permiso de gas.";
  }
  if (/signingrejected|user (refused|closed)|\bcancel|\bdenied|\bdeclin/i.test(mensaje)) {
    return "No se aprobó la firma. Puedes intentarlo otra vez.";
  }
  if (/host provider|not connected|disconnect/i.test(mensaje)) {
    return "Se perdió la conexión con la Polkadot App. Cierra la app y vuelve a abrirla.";
  }
  if (/sin respuesta en/i.test(mensaje)) {
    return "La Polkadot App no respondió a tiempo. Revisa tu teléfono y reintenta.";
  }
  if (codigo === 4001 || m.includes("user rejected") || m.includes("user denied") || m.includes("rejected the request")) {
    return "Cancelaste la operación en la wallet.";
  }
  if (m.includes("insufficient funds")) return "No tienes PAS suficientes para pagar el gas.";
  if (m.includes("already pending")) return "La wallet ya tiene una solicitud abierta. Revísala.";
  if (m.includes("timed out") || m.includes("timeout")) return "La red tardó demasiado en responder. Inténtalo de nuevo.";
  if (m.includes("fetch failed") || m.includes("failed to fetch") || m.includes("http request failed")) {
    return "No se pudo conectar con Polkadot Hub. Revisa tu conexión.";
  }
  return mensaje.split("\n")[0] || "Ocurrió un error inesperado.";
}

export function mensajeError(e: unknown): string {
  if (e instanceof BaseError) {
    const revert = e.walk((x) => x instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError && revert.data?.errorName) {
      return textoRevert(revert.data.errorName);
    }
    const conCodigo = e.walk((x) => typeof (x as { code?: unknown }).code === "number") as { code?: unknown } | null;
    return textoGenerico(e.shortMessage || e.message, conCodigo?.code);
  }
  if (e instanceof Error) return textoGenerico(e.message, (e as { code?: unknown }).code);
  if (typeof e === "object" && e !== null && "message" in e) {
    return textoGenerico(String((e as { message: unknown }).message), (e as { code?: unknown }).code);
  }
  // El SDK del Host a veces rechaza con objetos sin `message`.
  if (typeof e === "object" && e !== null) {
    try {
      return textoGenerico(JSON.stringify(e, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
    } catch {
      /* cae al mensaje genérico */
    }
  }
  return "Ocurrió un error inesperado.";
}
