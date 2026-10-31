import { describe, it, expect } from "vitest";
import { avanzar, mascotaAhora, momentoMuerte, type Necesidades } from "./tiempo";
import { Etapa, type Mascota } from "../contract/polkapets";

const LLENO: Necesidades = { hambre: 100, sed: 100, energia: 100, felicidad: 100, limpieza: 100 };

// Mismos números que contrato/test/PolkaPets.test.ts: sin cuidados muere a los 6750 s.
describe("avanzar (igual que el contrato)", () => {
  it("cada necesidad baja a su ritmo", () => {
    const v = avanzar(100, LLENO, 900);
    expect(v.necesidades).to.deep.equal({ hambre: 85, sed: 80, energia: 93, felicidad: 90, limpieza: 94 });
    expect(v.vida).to.equal(100);
    expect(v.muerteEn).to.equal(null);
  });

  it("pierde vida con la sed en 0", () => {
    const v = avanzar(100, LLENO, 5100);
    expect(v.necesidades.sed).to.equal(0);
    expect(v.vida).to.equal(80);
  });

  it("muere en el segundo exacto", () => {
    expect(avanzar(100, LLENO, 6749).vida).to.equal(1);
    const v = avanzar(100, LLENO, 6750);
    expect(v.vida).to.equal(0);
    expect(v.muerteEn).to.equal(6750);
    expect(avanzar(100, LLENO, 99_999).muerteEn).to.equal(6750);
  });
});

describe("momentoMuerte", () => {
  it("con una sola necesidad en 0 desde el inicio", () => {
    expect(momentoMuerte([0, 1000, 1000, 1000, 1000], 300)).to.equal(300);
  });
  it("límite 0 muere al instante", () => {
    expect(momentoMuerte([10, 20], 0)).to.equal(0);
  });
});

describe("mascotaAhora", () => {
  const m: Mascota = {
    tokenId: 1n,
    nombre: "Michi",
    especie: 0,
    nacimiento: 1000,
    ultimaInteraccion: 1000,
    vida: 100,
    ...LLENO,
    nivel: 1,
    xp: 0,
    viva: true,
    etapa: Etapa.Bebe,
    duracion: 0,
    muerte: 0,
  };

  it("avanza las barras y la duración", () => {
    const a = mascotaAhora(m, 900.7);
    expect(a.sed).to.equal(80);
    expect(a.duracion).to.equal(900);
    expect(a.viva).to.equal(true);
  });

  it("marca la muerte y fija la duración", () => {
    const a = mascotaAhora(m, 10_000);
    expect(a.viva).to.equal(false);
    expect(a.etapa).to.equal(Etapa.Muerta);
    expect(a.duracion).to.equal(6750);
    expect(a.muerte).to.equal(1000 + 6750);
  });

  it("una mascota muerta no cambia", () => {
    const muerta = { ...m, viva: false, etapa: Etapa.Muerta };
    expect(mascotaAhora(muerta, 500)).to.equal(muerta);
  });
});
