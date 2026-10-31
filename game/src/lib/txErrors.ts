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
  return "Ocurrió un error inesperado.";
}
