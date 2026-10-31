import { expect } from "chai";
import hre from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const { ethers } = hre;

const AJOLOTE = 0;

// Con todo al máximo, sin cuidados:
//  - la sed llega a 0 a los 100*45 = 4500 s y el hambre a los 100*60 = 6000 s;
//  - la vida (100 * 30 = 3000 segundos en cero) se agota a los 6750 s:
//    1500 s de sed sola (4500→6000) + 750 s de sed y hambre a la vez (2 por segundo).
const MUERTE_SIN_CUIDADOS = 6750;

describe("PolkaPets", () => {
  async function desplegar() {
    const [owner, otro] = await ethers.getSigners();
    const pets = await (await ethers.getContractFactory("PolkaPets")).deploy();
    await pets.waitForDeployment();
    return { pets, owner, otro };
  }

  async function adoptar(nombre = "Michi", especie = AJOLOTE) {
    const ctx = await desplegar();
    await ctx.pets.mint(nombre, especie);
    const nacimiento = (await ctx.pets.verMascota(1)).nacimiento;
    return { ...ctx, nacimiento };
  }

  it("adopta una mascota con nombre, especie y todo al máximo", async () => {
    const { pets, owner } = await desplegar();
    await expect(pets.mint("Michi", AJOLOTE))
      .to.emit(pets, "MascotaNacida")
      .withArgs(1n, owner.address, "Michi", AJOLOTE);

    const m = await pets.verMascota(1);
    expect(m.nombre).to.equal("Michi");
    expect(m.especie).to.equal(AJOLOTE);
    for (const v of [m.vida, m.hambre, m.sed, m.energia, m.felicidad, m.limpieza]) expect(v).to.equal(100);
    expect(m.viva).to.equal(true);
    expect(m.etapa).to.equal(0); // Bebé
    expect(await pets.ownerOf(1)).to.equal(owner.address);
  });

  it("rechaza nombres y especies inválidos", async () => {
    const { pets } = await desplegar();
    await expect(pets.mint("", AJOLOTE)).to.be.revertedWithCustomError(pets, "NombreInvalido");
    await expect(pets.mint("x".repeat(25), AJOLOTE)).to.be.revertedWithCustomError(pets, "NombreInvalido");
    await expect(pets.mint("Rex", 1)).to.be.revertedWithCustomError(pets, "EspecieInvalida");
  });

  it("cada necesidad baja a su ritmo", async () => {
    const { pets, nacimiento } = await adoptar();
    await time.increaseTo(nacimiento + 900n);
    const m = await pets.verMascota(1);
    expect(m.hambre).to.equal(100 - 15); // 900/60
    expect(m.sed).to.equal(100 - 20); // 900/45
    expect(m.energia).to.equal(100 - 7); // 900/120
    expect(m.felicidad).to.equal(100 - 10); // 900/90
    expect(m.limpieza).to.equal(100 - 6); // 900/150
    expect(m.vida).to.equal(100);
    expect(m.duracion).to.equal(900);
  });

  it("alimentar sube hambre y sed", async () => {
    const { pets, nacimiento } = await adoptar();
    await time.setNextBlockTimestamp(nacimiento + 1800n); // hambre 70, sed 60
    await pets.alimentar(1);
    const m = await pets.verMascota(1);
    expect(m.hambre).to.equal(100); // 70 + 40, tope 100
    expect(m.sed).to.equal(100); // 60 + 40
    expect(m.xp).to.equal(10);
  });

  it("jugar alegra pero cansa, da hambre y sed, y ensucia", async () => {
    const { pets } = await adoptar();
    await pets.jugar(1);
    const m = await pets.verMascota(1);
    expect(m.felicidad).to.equal(100);
    expect(m.energia).to.equal(85);
    expect(m.hambre).to.equal(90);
    expect(m.sed).to.equal(90);
    expect(m.limpieza).to.equal(85);
  });

  it("dormir recupera energía y bañar recupera limpieza", async () => {
    const { pets } = await adoptar();
    await pets.jugar(1); // energía 85, limpieza 85
    await pets.dormir(1);
    await pets.banar(1);
    const m = await pets.verMascota(1);
    expect(m.energia).to.equal(100);
    expect(m.limpieza).to.equal(100);
  });

  it("pierde vida mientras una necesidad está en 0 y muere en el segundo exacto", async () => {
    const { pets, nacimiento } = await adoptar();

    await time.increaseTo(nacimiento + 5100n); // sed en 0 desde 4500: 600 s → -20 de vida
    let m = await pets.verMascota(1);
    expect(m.sed).to.equal(0);
    expect(m.vida).to.equal(80);
    expect(m.etapa).to.equal(3); // Enferma
    expect(m.viva).to.equal(true);

    await time.increaseTo(nacimiento + BigInt(MUERTE_SIN_CUIDADOS - 1));
    m = await pets.verMascota(1);
    expect(m.viva).to.equal(true);
    expect(m.vida).to.equal(1);

    await time.increaseTo(nacimiento + BigInt(MUERTE_SIN_CUIDADOS));
    m = await pets.verMascota(1);
    expect(m.viva).to.equal(false);
    expect(m.vida).to.equal(0);
    expect(m.etapa).to.equal(4); // Muerta
    expect(m.duracion).to.equal(MUERTE_SIN_CUIDADOS);

    // La duración queda fija aunque pase más tiempo.
    await time.increase(10_000);
    expect((await pets.verMascota(1)).duracion).to.equal(MUERTE_SIN_CUIDADOS);
    await expect(pets.alimentar(1)).to.be.revertedWithCustomError(pets, "EstaMuerta");
  });

  it("cuidar recupera vida si ninguna necesidad queda en 0", async () => {
    const { pets, nacimiento } = await adoptar();
    await time.setNextBlockTimestamp(nacimiento + 5100n); // vida 80, sed 0
    await pets.alimentar(1); // sed 40, hambre 55 → +5 vida
    const m = await pets.verMascota(1);
    expect(m.vida).to.equal(85);
    expect(m.etapa).to.equal(0);
  });

  it("sube de nivel al acumular XP", async () => {
    const { pets } = await adoptar();
    for (let i = 0; i < 10; i++) await pets.dormir(1);
    const m = await pets.verMascota(1);
    expect(m.nivel).to.equal(2);
    expect(m.xp).to.equal(0);
    expect(m.etapa).to.equal(1); // Joven
  });

  it("cambia el nombre solo el dueño", async () => {
    const { pets, otro } = await adoptar();
    await expect(pets.cambiarNombre(1, "Pelusa")).to.emit(pets, "NombreCambiado").withArgs(1n, "Pelusa");
    expect((await pets.verMascota(1)).nombre).to.equal("Pelusa");
    await expect(pets.connect(otro).cambiarNombre(1, "Robo")).to.be.revertedWithCustomError(pets, "NoEresDueno");
    await expect(pets.cambiarNombre(1, "")).to.be.revertedWithCustomError(pets, "NombreInvalido");
  });

  it("solo el dueño puede cuidar", async () => {
    const { pets, otro } = await adoptar();
    await expect(pets.connect(otro).alimentar(1)).to.be.revertedWithCustomError(pets, "NoEresDueno");
  });

  it("el ranking devuelve la duración de cada mascota", async () => {
    const { pets, owner, otro } = await desplegar();
    await pets.mint("Vieja", AJOLOTE);
    const nacimiento = (await pets.verMascota(1)).nacimiento;
    await time.setNextBlockTimestamp(nacimiento + 100n);
    await pets.connect(otro).mint("Nueva", AJOLOTE);
    await time.increaseTo(nacimiento + 10_000n); // la primera ya murió (a los 6750 s)

    expect(await pets.totalMascotas()).to.equal(2);
    const filas = await pets.ranking(0, 50);
    expect(filas.length).to.equal(2);
    expect(filas[0].nombre).to.equal("Vieja");
    expect(filas[0].dueno).to.equal(owner.address);
    expect(filas[0].viva).to.equal(false);
    expect(filas[0].duracion).to.equal(MUERTE_SIN_CUIDADOS);
    expect(filas[1].nombre).to.equal("Nueva");
    expect(filas[1].dueno).to.equal(otro.address);
    expect(filas[1].viva).to.equal(false);
    expect(filas[1].duracion).to.equal(MUERTE_SIN_CUIDADOS);

    expect((await pets.ranking(1, 50)).length).to.equal(1);
    expect((await pets.ranking(5, 50)).length).to.equal(0);
  });

  it("lista las mascotas de un dueño", async () => {
    const { pets, owner } = await desplegar();
    await pets.mint("A", AJOLOTE);
    await pets.mint("B", AJOLOTE);
    const ids = await pets.mascotasDe(owner.address);
    expect(ids.map((x) => Number(x))).to.deep.equal([1, 2]);
  });
});
