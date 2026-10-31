import { describe, it, expect } from "vitest";
import {
  decodeMascota,
  decodeRanking,
  especie,
  etapaPorNivel,
  etiquetaEtapa,
  nombreValido,
  Etapa,
} from "./polkapets";

describe("decodeMascota", () => {
  it("convierte el struct de viem a números", () => {
    const m = decodeMascota({
      tokenId: 3n,
      nombre: "Michi",
      especie: 2,
      nacimiento: 1000n,
      ultimaInteraccion: 1100n,
      vida: 90,
      hambre: 80,
      sed: 70,
      energia: 60,
      felicidad: 50,
      limpieza: 40,
      nivel: 2,
      xp: 30,
      viva: true,
      etapa: 1,
      duracion: 500n,
      muerte: 0n,
    });
    expect(m.tokenId).to.equal(3n);
    expect(m.nombre).to.equal("Michi");
    expect(m.especie).to.equal(2);
    expect(m.nacimiento).to.equal(1000);
    expect(m.sed).to.equal(70);
    expect(m.limpieza).to.equal(40);
    expect(m.etapa).to.equal(Etapa.Joven);
    expect(m.duracion).to.equal(500);
    expect(m.viva).to.equal(true);
  });
});

describe("decodeRanking", () => {
  it("decodifica filas y tolera valores raros", () => {
    const filas = decodeRanking([
      { tokenId: 1n, dueno: "0xabc", nombre: "A", especie: 0, duracion: 60n, viva: false },
    ]);
    expect(filas).to.deep.equal([
      { tokenId: 1n, dueno: "0xabc", nombre: "A", especie: 0, duracion: 60, viva: false },
    ]);
    expect(decodeRanking(null)).to.deep.equal([]);
  });
});

describe("nombreValido", () => {
  it("cuenta bytes UTF-8 como el contrato", () => {
    expect(nombreValido("Rex")).to.equal(true);
    expect(nombreValido("   ")).to.equal(false);
    expect(nombreValido("x".repeat(24))).to.equal(true);
    expect(nombreValido("x".repeat(25))).to.equal(false);
    // 12 "ñ" son 24 bytes; 13 son 26.
    expect(nombreValido("ñ".repeat(12))).to.equal(true);
    expect(nombreValido("ñ".repeat(13))).to.equal(false);
  });
});

describe("especie y etapas", () => {
  it("devuelve la especie y cae en la primera si el id no existe", () => {
    expect(especie(3).nombre).to.equal("Pingüino");
    expect(especie(99).nombre).to.equal("Gato");
  });
  it("etapa por nivel y etiquetas", () => {
    expect(etapaPorNivel(1)).to.equal(Etapa.Bebe);
    expect(etapaPorNivel(2)).to.equal(Etapa.Joven);
    expect(etapaPorNivel(10)).to.equal(Etapa.Adulta);
    expect(etiquetaEtapa(Etapa.Muerta)).to.equal("Muerta");
  });
});
