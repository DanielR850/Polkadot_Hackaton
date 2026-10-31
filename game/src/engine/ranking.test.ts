import { describe, it, expect } from "vitest";
import { ordenarRanking } from "./ranking";
import type { FilaRanking } from "../contract/polkapets";

const fila = (tokenId: bigint, duracion: number, dueno = "0xAAA"): FilaRanking => ({
  tokenId,
  dueno: dueno as `0x${string}`,
  nombre: `M${tokenId}`,
  especie: 0,
  duracion,
  viva: false,
});

describe("ordenarRanking", () => {
  it("ordena por duración y desempata por antigüedad", () => {
    const r = ordenarRanking([fila(1n, 10), fila(2n, 50), fila(3n, 50)], null);
    expect(r.map((f) => f.tokenId)).to.deep.equal([2n, 3n, 1n]);
    expect(r.map((f) => f.posicion)).to.deep.equal([1, 2, 3]);
  });

  it("marca las mías sin importar mayúsculas", () => {
    const r = ordenarRanking([fila(1n, 10, "0xabc"), fila(2n, 5, "0xDEF")], "0xABC");
    expect(r[0].mia).to.equal(true);
    expect(r[1].mia).to.equal(false);
  });

  it("recorta al límite", () => {
    const filas = Array.from({ length: 15 }, (_, i) => fila(BigInt(i + 1), i));
    expect(ordenarRanking(filas, null).length).to.equal(10);
  });
});
