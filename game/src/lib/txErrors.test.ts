import { describe, it, expect } from "vitest";
import { mensajeError, textoGenerico, textoRevert } from "./txErrors";

describe("textoRevert", () => {
  it("traduce los errores del contrato", () => {
    expect(textoRevert("EstaMuerta")).to.equal("Tu mascota ya murió. Empieza una partida nueva.");
    expect(textoRevert("Otro")).to.equal("El contrato rechazó la operación (Otro).");
  });
});

describe("textoGenerico y mensajeError", () => {
  it("reconoce rechazos de la wallet por código o texto", () => {
    expect(textoGenerico("algo", 4001)).to.equal("Cancelaste la operación en la wallet.");
    expect(mensajeError(new Error("User rejected the request."))).to.equal("Cancelaste la operación en la wallet.");
    expect(mensajeError({ code: 4001, message: "x" })).to.equal("Cancelaste la operación en la wallet.");
  });

  it("reconoce falta de fondos", () => {
    expect(mensajeError(new Error("insufficient funds for gas"))).to.equal("No tienes PAS suficientes para pagar el gas.");
  });

  it("se queda con la primera línea de errores largos", () => {
    expect(mensajeError(new Error("Primera\nsegunda"))).to.equal("Primera");
    expect(mensajeError(42)).to.equal("Ocurrió un error inesperado.");
  });
});
