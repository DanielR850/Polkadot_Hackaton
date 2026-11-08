import { describe, it, expect } from "vitest";
import { diagnosticar, progresoXp } from "./salud";
import { Etapa, type Mascota } from "../contract/polkapets";

function mascota(over: Partial<Mascota> = {}): Mascota {
  return {
    tokenId: 1n,
    nombre: "Rex",
    especie: 1,
    nacimiento: 0,
    ultimaInteraccion: 0,
    vida: 100,
    hambre: 80,
    sed: 80,
    energia: 80,
    felicidad: 80,
    limpieza: 80,
    nivel: 1,
    xp: 0,
    viva: true,
    etapa: Etapa.Bebe,
    duracion: 0,
    muerte: 0,
    ...over,
  };
}

describe("diagnosticar", () => {
  it("sana", () => {
    const d = diagnosticar(mascota());
    expect(d.urgencia).to.equal("bien");
    expect(d.consejo).to.equal(null);
  });

  it("recomienda la acción de la necesidad más baja", () => {
    expect(diagnosticar(mascota({ sed: 10 })).consejo).to.equal("alimentar");
    expect(diagnosticar(mascota({ energia: 10 })).consejo).to.equal("dormir");
    expect(diagnosticar(mascota({ felicidad: 10 })).consejo).to.equal("jugar");
    expect(diagnosticar(mascota({ limpieza: 10 })).consejo).to.equal("banar");
    expect(diagnosticar(mascota({ limpieza: 10 })).urgencia).to.equal("atencion");
  });

  it("crítico con una necesidad en 0", () => {
    const d = diagnosticar(mascota({ hambre: 0 }));
    expect(d.urgencia).to.equal("critico");
    expect(d.consejo).to.equal("alimentar");
  });

  it("atención con poca vida aunque las necesidades estén bien", () => {
    expect(diagnosticar(mascota({ vida: 20 })).urgencia).to.equal("atencion");
  });

  it("muerta muestra cuánto vivió", () => {
    const d = diagnosticar(mascota({ viva: false, duracion: 3720 }));
    expect(d.urgencia).to.equal("muerta");
    expect(d.mensaje).to.equal("Rex vivió 1 h 2 min.");
  });
});

describe("progresoXp", () => {
  it("porcentaje hacia el siguiente nivel", () => {
    expect(progresoXp({ xp: 0 })).to.equal(0);
    expect(progresoXp({ xp: 50 })).to.equal(50);
  });
});
