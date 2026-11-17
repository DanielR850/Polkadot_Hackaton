import { describe, it, expect } from "vitest";
import { acortarDireccion, clampStat, duracionHumana } from "./format";

describe("acortarDireccion", () => {
  it("acorta direcciones largas y deja las cortas", () => {
    expect(acortarDireccion("0x1234567890abcdef1234567890abcdef12345678")).to.equal("0x1234…5678");
    expect(acortarDireccion("0x1234")).to.equal("0x1234");
  });
});

describe("duracionHumana", () => {
  it("formatea cada rango", () => {
    expect(duracionHumana(45)).to.equal("45 s");
    expect(duracionHumana(120)).to.equal("2 min");
    expect(duracionHumana(725)).to.equal("12 min 5 s");
    expect(duracionHumana(7200)).to.equal("2 h");
    expect(duracionHumana(12_000)).to.equal("3 h 20 min");
    expect(duracionHumana(187_200)).to.equal("2 d 4 h");
    expect(duracionHumana(-5)).to.equal("0 s");
  });
});

describe("clampStat", () => {
  it("recorta al rango 0–100", () => {
    expect(clampStat(-5)).to.equal(0);
    expect(clampStat(150)).to.equal(100);
    expect(clampStat(42.6)).to.equal(43);
    expect(clampStat(NaN)).to.equal(0);
  });
});
