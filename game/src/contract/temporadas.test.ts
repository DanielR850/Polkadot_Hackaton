import { describe, expect, it } from "vitest";
import { calendario, LUNES_MEXICO_MS } from "./temporadas";

const DIA = 86_400_000;

describe("calendario de temporadas (hora de México, UTC-6)", () => {
  // Lunes 2026-11-16 00:00 en México = 06:00 UTC.
  const lunes = Date.UTC(2026, 10, 16, 6, 0, 0);

  it("el lunes de referencia es un lunes a las 00:00 de México", () => {
    expect(new Date(LUNES_MEXICO_MS).getUTCDay()).toBe(1);
    expect(new Date(LUNES_MEXICO_MS).getUTCHours()).toBe(6);
    expect((lunes - LUNES_MEXICO_MS) % (7 * DIA)).toBe(0);
  });

  it("abre de lunes 00:00 a viernes 23:59:59 y cierra el fin de semana", () => {
    expect(calendario(lunes).abierta).toBe(true);
    expect(calendario(lunes - 1).abierta).toBe(false); // domingo 23:59:59
    expect(calendario(lunes + 5 * DIA - 1).abierta).toBe(true); // viernes 23:59:59
    expect(calendario(lunes + 5 * DIA).abierta).toBe(false); // sábado
    const c = calendario(lunes + 2 * DIA);
    expect(c.abre).toBe(lunes);
    expect(c.cierra).toBe(lunes + 5 * DIA);
  });

  it("cada lunes empieza una semana nueva", () => {
    const a = calendario(lunes + 3 * DIA).semana;
    expect(calendario(lunes + 7 * DIA).semana).toBe(a + 1);
    expect(calendario(lunes + 6 * DIA + 23 * 3_600_000).semana).toBe(a);
  });
});
